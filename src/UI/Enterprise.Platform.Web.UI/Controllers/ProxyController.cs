using System.Diagnostics;
using System.Net.Http.Headers;
using Enterprise.Platform.Web.UI.Configuration;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using HttpHeaderNames = Enterprise.Platform.Shared.Constants.HttpHeaderNames;

namespace Enterprise.Platform.Web.UI.Controllers;

/// <summary>
/// Forwards SPA XHRs to the downstream Api. The host authenticates the browser
/// via cookie; this controller attaches a <c>Bearer</c> token to the downstream
/// call when one is available on the session. Body, query, and most headers are
/// passed through; hop-by-hop headers (<c>Connection</c>, <c>Transfer-Encoding</c>,
/// etc.) are stripped per RFC 7230 §6.1.
/// </summary>
/// <remarks>
/// <para>
/// <b>CSRF posture.</b> <see cref="AutoValidateAntiforgeryTokenAttribute"/> on
/// the class validates anti-forgery tokens on all "unsafe" HTTP verbs
/// (POST/PUT/PATCH/DELETE) but skips "safe" ones (GET/HEAD/OPTIONS/TRACE).
/// The SPA obtains the token by calling
/// <c>GET /api/antiforgery/token</c> once per session — that action sets the
/// readable <c>XSRF-TOKEN</c> cookie which Angular's built-in
/// <c>HttpXsrfInterceptor</c> reads and echoes as <c>X-XSRF-TOKEN</c> on every
/// mutating XHR. Missing / mismatched token = 400 Bad Request.
/// </para>
/// <para>
/// For production traffic shaping, consider swapping this controller for YARP.
/// The hand-rolled version here keeps dependencies small + lets the auth swap
/// be explicit while the foundation is still taking shape.
/// </para>
/// </remarks>
[Authorize]
[ApiController]
[AutoValidateAntiforgeryToken]
[Route("api/proxy")]
public sealed partial class ProxyController(
    IHttpClientFactory httpClientFactory,
    IOptionsMonitor<ProxySettings> settings,
    ILogger<ProxyController> logger) : ControllerBase
{
    // ── source-generated log delegates (CA1848 compliance) ─────────────

    [LoggerMessage(EventId = 4001, Level = LogLevel.Information,
        Message = "Bff.Proxy.Hop — {Method} {DownstreamPath} → {Status} in {ElapsedMs}ms (sub={Sub})")]
    private partial void LogHop(string method, string downstreamPath, int status, long elapsedMs, string sub);

    [LoggerMessage(EventId = 4002, Level = LogLevel.Warning,
        Message = "Bff.Proxy.Unreachable — {Target} failed: {Reason}")]
    private partial void LogUnreachable(Uri target, string reason, Exception ex);

    [LoggerMessage(EventId = 4003, Level = LogLevel.Error,
        Message = "Bff.Proxy.CopyFailed — {Target} response copy threw {Reason}")]
    private partial void LogCopyFailed(Uri target, string reason, Exception ex);

    [LoggerMessage(EventId = 4004, Level = LogLevel.Information,
        Message = "Bff.Proxy.BodyRead — {Method} {DownstreamPath} contentType={ContentType} declaredLength={DeclaredLength} bytesRead={BytesRead} preview={Preview}")]
    private partial void LogBodyRead(string method, string downstreamPath, string? contentType, long? declaredLength, int bytesRead, string preview);

    /// <summary>Named HTTP client registered in Program.cs.</summary>
    public const string HttpClientName = "ep-proxy-api";

    private static readonly HashSet<string> HopByHopHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Connection", "Keep-Alive", "Proxy-Authenticate", "Proxy-Authorization",
        "TE", "Trailers", "Transfer-Encoding", "Upgrade",
        "Host", "Content-Length", "Content-Type",
    };

    private readonly IHttpClientFactory _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
    private readonly IOptionsMonitor<ProxySettings> _settings = settings ?? throw new ArgumentNullException(nameof(settings));
    private readonly ILogger<ProxyController> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <summary>Catch-all proxy — captures the remaining path segment after <c>/api/proxy</c>.</summary>
    [HttpGet("{**downstreamPath}")]
    [HttpPost("{**downstreamPath}")]
    [HttpPut("{**downstreamPath}")]
    [HttpPatch("{**downstreamPath}")]
    [HttpDelete("{**downstreamPath}")]
    public async Task<IActionResult> Forward(string downstreamPath, CancellationToken cancellationToken)
    {
        var opts = _settings.CurrentValue;
        var stopwatch = Stopwatch.StartNew();

        if (!Uri.TryCreate(new Uri(opts.ApiBaseUri), downstreamPath + HttpContext.Request.QueryString.Value, out var target))
        {
            return BadRequest("Invalid downstream URI.");
        }

        using var request = new HttpRequestMessage(new HttpMethod(HttpContext.Request.Method), target);

        // Forward body when present (POST/PUT/PATCH). We materialise the
        // request body into a byte array so the downstream HttpClient sees a
        // known Content-Length AND we don't depend on the request body stream
        // staying readable past whatever the action-filter pipeline does to it
        // (the StreamContent variant silently produced empty bodies under
        // [AutoValidateAntiforgeryToken] in a way that surfaced as backend
        // FluentValidation errors with "field must not be empty" on every
        // mutation, even though the SPA sent the values correctly).
        if (HttpContext.Request.ContentLength > 0 || HttpContext.Request.Headers.ContainsKey("Transfer-Encoding"))
        {
            // EnableBuffering wraps the request body in a re-readable stream
            // (memory + spill-to-disk past 30KB by default). We then rewind to
            // 0 before reading — guarantees we get the full body even if some
            // earlier middleware peeked at it.
            HttpContext.Request.EnableBuffering();
            HttpContext.Request.Body.Position = 0;

            // The body read MUST NOT honour HttpContext.RequestAborted —
            // Kestrel toggles that token transiently during the action filter
            // chain (a transient cancellation surfaces as TaskCanceledException
            // that bypasses the SendAsync try/catch and 500s the request).
            // Wrap defensively so any failure here is caught and surfaced as a
            // 502 alongside the SendAsync error path, never a raw 500.
            byte[] bodyBytes;
            try
            {
                using var bodyBuffer = new MemoryStream();
                await HttpContext.Request.Body.CopyToAsync(bodyBuffer, CancellationToken.None).ConfigureAwait(false);
                bodyBytes = bodyBuffer.ToArray();
            }
            catch (Exception ex) when (ex is OperationCanceledException or IOException)
            {
                LogUnreachable(target, $"body-read:{ex.GetType().Name}", ex);
                return StatusCode(StatusCodes.Status502BadGateway, new
                {
                    detail = "Could not read upstream request body.",
                    reason = ex.GetType().Name,
                });
            }

            // Diagnostic: the SPA's Create/Edit user dialog was hitting the
            // API with an empty JSON body and FluentValidation was rejecting
            // every field as required. Logging the bytes read here tells us
            // whether the BFF received the body at all (vs. lost it inside
            // the action filter chain).
            var preview = bodyBytes.Length == 0
                ? "<empty>"
                : System.Text.Encoding.UTF8.GetString(bodyBytes, 0, Math.Min(bodyBytes.Length, 500));
            LogBodyRead(
                HttpContext.Request.Method,
                downstreamPath,
                HttpContext.Request.ContentType,
                HttpContext.Request.ContentLength,
                bodyBytes.Length,
                preview);

            request.Content = new ByteArrayContent(bodyBytes);
            if (!string.IsNullOrEmpty(HttpContext.Request.ContentType))
            {
                request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(HttpContext.Request.ContentType);
            }
        }

        // Forward benign headers; hop-by-hop are stripped.
        foreach (var header in HttpContext.Request.Headers)
        {
            if (HopByHopHeaders.Contains(header.Key))
            {
                continue;
            }

            request.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray());
        }

        // Correlation ID — explicit set so the downstream Api log line ties
        // back to the host + browser request via a single id, even though the
        // generic header-copy loop above also covers this. Belt + braces;
        // also ensures the header is set when the loop's Cookie/Auth filtering
        // changes in the future.
        var correlationId = HttpContext.Response.Headers[HttpHeaderNames.CorrelationId].ToString();
        if (!string.IsNullOrWhiteSpace(correlationId))
        {
            request.Headers.Remove(HttpHeaderNames.CorrelationId);
            request.Headers.TryAddWithoutValidation(HttpHeaderNames.CorrelationId, correlationId);
        }

        // Attach bearer token when the session has one (OIDC SaveTokens path).
        if (opts.AttachBearerToken)
        {
            var accessToken = await HttpContext.GetTokenAsync("access_token").ConfigureAwait(false);
            if (!string.IsNullOrEmpty(accessToken))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            }
        }

        using var client = _httpClientFactory.CreateClient(HttpClientName);
        client.Timeout = opts.Timeout;

        HttpResponseMessage response;
        try
        {
            response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidOperationException)
        {
            // Widened from `HttpRequestException` alone — depending on the failure
            // layer, HttpClient can emit TaskCanceledException (timeout or caller
            // abort) or InvalidOperationException (bad request shape). All three
            // mean "we couldn't get a response from the Api"; the SPA treats any
            // 502 as a transport-layer issue (not a server error).
            LogUnreachable(target, ex.GetType().Name, ex);
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                detail = "Downstream Api unreachable.",
                reason = ex.GetType().Name,
                target = target.ToString(),
            });
        }

        try
        {
            HttpContext.Response.StatusCode = (int)response.StatusCode;
            foreach (var header in response.Headers.Concat(response.Content.Headers))
            {
                if (HopByHopHeaders.Contains(header.Key))
                {
                    continue;
                }

                HttpContext.Response.Headers[header.Key] = header.Value.ToArray();
            }

            // Ensure no duplicate content-length after we stream.
            HttpContext.Response.Headers.ContentLength = null;

            await response.Content.CopyToAsync(HttpContext.Response.Body, cancellationToken).ConfigureAwait(false);
            stopwatch.Stop();

            // Per-hop structured log — ties this proxy round-trip to the
            // host/Api correlation id stream. The `sub` claim narrows queries
            // to a single user across both host and Api logs.
            var sub = User.FindFirst("sub")?.Value
                ?? User.FindFirst("preferred_username")?.Value
                ?? "anonymous";
            LogHop(
                request.Method.Method,
                downstreamPath,
                (int)response.StatusCode,
                stopwatch.ElapsedMilliseconds,
                sub);

            return new EmptyResult();
        }
        catch (Exception ex)
        {
            // Something failed AFTER we started writing the response (status/
            // headers may already be committed). Log it loudly — we likely
            // can't change the status code anymore so ASP.NET will emit 500,
            // but the log captures the real cause for diagnosis.
            LogCopyFailed(target, ex.GetType().Name, ex);
            throw;
        }
        finally
        {
            response.Dispose();
        }
    }
}
