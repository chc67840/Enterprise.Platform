using System.Net.Http.Headers;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Web.UI.Configuration;

/// <summary>
/// Dev-time reverse proxy that forwards unmatched HTTP requests from the BFF
/// (<c>:5001</c>) to the Angular dev server (<c>:4200</c>). Registered as the
/// terminal endpoint via <see cref="SpaProxyEndpointExtensions.MapSpaProxyFallback"/>
/// so it only fires when no controller / OIDC-middleware handler owns the
/// request.
/// </summary>
/// <remarks>
/// <para>
/// Mirror of <see cref="Controllers.BffProxyController"/> minus the bearer
/// attachment — static-asset delivery doesn't need tokens. Same hop-by-hop
/// header stripping per RFC 7230 §6.1.
/// </para>
/// <para>
/// <b>Known limits.</b> WebSockets are not forwarded (HMR stays on <c>:4200</c>).
/// GZIP / Brotli negotiation is pass-through — the Angular dev server handles
/// content negotiation upstream.
/// </para>
/// </remarks>
public sealed partial class SpaProxyMiddleware(
    IHttpClientFactory httpClientFactory,
    IOptionsMonitor<BffSpaSettings> settings,
    ILogger<SpaProxyMiddleware> logger)
{
    /// <summary>Named HTTP client used for upstream SPA forwarding.</summary>
    public const string HttpClientName = "ep-bff-spa-proxy";

    // RFC 7230 §6.1 hop-by-hop — never propagate in either direction.
    private static readonly HashSet<string> HopByHopHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Connection", "Keep-Alive", "Proxy-Authenticate", "Proxy-Authorization",
        "TE", "Trailers", "Transfer-Encoding", "Upgrade",
    };

    // Request-only — stripped when forwarding to upstream (we set our own
    // target Host + let HttpClient compute Content-Length).
    private static readonly HashSet<string> RequestOnlyHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Host", "Content-Length",
    };

    private readonly IHttpClientFactory _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
    private readonly IOptionsMonitor<BffSpaSettings> _settings = settings ?? throw new ArgumentNullException(nameof(settings));
    private readonly ILogger<SpaProxyMiddleware> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    // ── source-generated log delegates (CA1848 compliance) ─────────────

    [LoggerMessage(EventId = 3001, Level = LogLevel.Warning,
        Message = "Spa.Proxy.UpstreamUnreachable — could not reach {Target}; is `ng serve` running on the configured port?")]
    private partial void LogUpstreamUnreachable(Uri target, Exception ex);

    /// <summary>
    /// Forwards the current HTTP request to the configured upstream Angular
    /// dev server. Does not perform WebSocket upgrades.
    /// </summary>
    public async Task ForwardAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var opts = _settings.CurrentValue;
        var upstream = new Uri(opts.UpstreamUri);
        var targetUri = new UriBuilder(upstream)
        {
            Path = context.Request.Path,
            Query = context.Request.QueryString.HasValue
                ? context.Request.QueryString.Value!.TrimStart('?')
                : string.Empty,
        }.Uri;

        using var request = new HttpRequestMessage(new HttpMethod(context.Request.Method), targetUri);

        // Forward request body when present (POST/PUT/PATCH — uncommon for
        // static SPA assets but cheap to support).
        if (context.Request.ContentLength > 0 ||
            context.Request.Headers.ContainsKey("Transfer-Encoding"))
        {
            request.Content = new StreamContent(context.Request.Body);
            if (!string.IsNullOrEmpty(context.Request.ContentType))
            {
                request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(context.Request.ContentType);
            }
        }

        foreach (var header in context.Request.Headers)
        {
            if (HopByHopHeaders.Contains(header.Key) || RequestOnlyHeaders.Contains(header.Key))
            {
                continue;
            }
            request.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray());
        }

        using var client = _httpClientFactory.CreateClient(HttpClientName);
        client.Timeout = opts.Timeout;

        HttpResponseMessage response;
        try
        {
            response = await client.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                context.RequestAborted).ConfigureAwait(false);
        }
        catch (HttpRequestException ex)
        {
            LogUpstreamUnreachable(upstream, ex);
            context.Response.StatusCode = StatusCodes.Status502BadGateway;
            await context.Response.WriteAsync(
                $"SPA dev server unreachable at {upstream}. Run `ng serve` in the ClientApp directory.",
                context.RequestAborted).ConfigureAwait(false);
            return;
        }

        using (response)
        {
            context.Response.StatusCode = (int)response.StatusCode;
            foreach (var header in response.Headers.Concat(response.Content.Headers))
            {
                if (HopByHopHeaders.Contains(header.Key))
                {
                    continue;
                }
                context.Response.Headers[header.Key] = header.Value.ToArray();
            }

            context.Response.Headers.ContentLength = null;

            await response.Content
                .CopyToAsync(context.Response.Body, context.RequestAborted)
                .ConfigureAwait(false);
        }
    }
}

/// <summary>
/// Extension methods that register the SPA proxy as a fallback endpoint — i.e.
/// it handles any request not matched by controllers or dedicated middleware.
/// </summary>
public static class SpaProxyEndpointExtensions
{
    /// <summary>
    /// Registers SPA handling as a terminal endpoint. Behaviour depends on
    /// <see cref="BffSpaSettings.UseDevProxy"/>:
    /// <list type="bullet">
    ///   <item><b>Dev proxy mode</b> — forwards to the Angular dev server via <see cref="SpaProxyMiddleware"/>.</item>
    ///   <item><b>Static mode</b> — serves <c>wwwroot/index.html</c> for any unmatched route (classic SPA fallback).</item>
    /// </list>
    /// </summary>
    public static void MapSpaProxyFallback(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        // IMPORTANT: the single-arg MapFallback uses the `{*path:nonfile}`
        // route constraint which excludes any path that looks like a file
        // (i.e. has a `.` in the last segment — `/styles.css`, `/main.js`).
        // For an SPA reverse proxy we explicitly want ALL unmatched paths
        // to proxy — Angular owns static assets too. Using the two-arg
        // overload with `{**catchAll}` keeps the fallback-order semantics
        // (runs last via `Order = int.MaxValue`) but drops the nonfile
        // constraint.
        endpoints.MapFallback("/{**catchAll}", async context =>
        {
            // Defence in depth — API + OIDC paths should already be owned by
            // their controllers / middleware. Returning 404 for obvious path
            // prefixes prevents accidentally proxying an unhandled API call
            // to the Angular dev server (which would emit confusing 404 HTML).
            var path = context.Request.Path.Value ?? string.Empty;
            if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase) ||
                path.StartsWith("/signin-oidc", StringComparison.OrdinalIgnoreCase) ||
                path.StartsWith("/signout-callback-oidc", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            var settings = context.RequestServices
                .GetRequiredService<IOptionsMonitor<BffSpaSettings>>()
                .CurrentValue;

            if (settings.UseDevProxy)
            {
                var proxy = context.RequestServices.GetRequiredService<SpaProxyMiddleware>();
                await proxy.ForwardAsync(context).ConfigureAwait(false);
                return;
            }

            // Production SPA-fallback: serve index.html for any unmatched
            // route so the Angular router can resolve it client-side.
            var env = context.RequestServices.GetRequiredService<IWebHostEnvironment>();
            var indexPath = Path.Combine(env.WebRootPath, "index.html");
            if (!File.Exists(indexPath))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            context.Response.ContentType = "text/html; charset=utf-8";
            await context.Response.SendFileAsync(indexPath, context.RequestAborted).ConfigureAwait(false);
        });
    }
}
