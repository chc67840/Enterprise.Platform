using System.Globalization;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Web.UI.Configuration;

/// <summary>
/// Proactively rotates the BFF session's stashed access token before Entra's
/// copy expires. Hooked into the cookie scheme's
/// <see cref="CookieAuthenticationEvents.OnValidatePrincipal"/> event, this
/// service runs on every authenticated request and:
/// <list type="number">
///   <item>Reads <c>access_token</c> / <c>refresh_token</c> / <c>expires_at</c> from the cookie ticket.</item>
///   <item>Exits fast when the token has more than <see cref="RefreshThreshold"/> of life left.</item>
///   <item>Otherwise POSTs to Entra's token endpoint with the refresh token.</item>
///   <item>On success: overwrites the ticket tokens + flags the cookie for re-issue via <see cref="CookieValidatePrincipalContext.ShouldRenew"/>.</item>
///   <item>On failure: rejects the principal so the SPA sees a 401 on the next request and triggers re-login.</item>
/// </list>
/// </summary>
/// <remarks>
/// <para>
/// Without this service, sessions look alive from the cookie's perspective
/// (<c>ExpireTimeSpan = 8h</c>) but the stashed access token dies after
/// ~60 min — causing the proxy to forward an expired bearer and the downstream
/// Api to return 401. This service keeps the stashed token fresh so proxy
/// calls Just Work for the full cookie lifetime.
/// </para>
/// <para>
/// Uses <see cref="IHttpClientFactory"/> — one short-lived request per refresh,
/// pooled by HttpClientFactory. No manual <c>HttpClient</c> instance lifetime
/// management, no socket exhaustion.
/// </para>
/// </remarks>
public sealed partial class BffTokenRefreshService(
    IHttpClientFactory httpClientFactory,
    IOptionsMonitor<AzureAdBffSettings> settings,
    BffSessionMetrics metrics,
    ILogger<BffTokenRefreshService> logger)
{
    /// <summary>Named HTTP client used for the Entra token exchange call.</summary>
    public const string HttpClientName = "ep-bff-token-refresh";

    /// <summary>
    /// Refresh when the current access token has less than this much life
    /// left. Keep generous so a slow refresh call completes before the
    /// proxied downstream call hits Api and finds the token expired.
    /// </summary>
    public static readonly TimeSpan RefreshThreshold = TimeSpan.FromMinutes(5);

    private readonly IHttpClientFactory _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
    private readonly IOptionsMonitor<AzureAdBffSettings> _settings = settings ?? throw new ArgumentNullException(nameof(settings));
    private readonly BffSessionMetrics _metrics = metrics ?? throw new ArgumentNullException(nameof(metrics));
    private readonly ILogger<BffTokenRefreshService> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    // ── source-generated log delegates (CA1848 compliance) ─────────────

    [LoggerMessage(EventId = 2001, Level = LogLevel.Debug,
        Message = "Token.Refresh.Skip — {SecondsRemaining}s remaining, above {ThresholdSeconds}s threshold.")]
    private partial void LogRefreshSkip(double secondsRemaining, double thresholdSeconds);

    [LoggerMessage(EventId = 2002, Level = LogLevel.Warning,
        Message = "Token.Refresh.MissingStashedTokens — rejecting principal; session cookie is malformed.")]
    private partial void LogMissingTokens();

    [LoggerMessage(EventId = 2003, Level = LogLevel.Information,
        Message = "Token.Refresh.Attempt — {SecondsRemaining}s remaining; calling Entra token endpoint.")]
    private partial void LogRefreshAttempt(double secondsRemaining);

    [LoggerMessage(EventId = 2004, Level = LogLevel.Information,
        Message = "Token.Refresh.Success — new access token valid for {ExpiresInSeconds}s.")]
    private partial void LogRefreshSuccess(int expiresInSeconds);

    [LoggerMessage(EventId = 2005, Level = LogLevel.Warning,
        Message = "Token.Refresh.Failed — Entra returned {StatusCode}; rejecting principal.")]
    private partial void LogRefreshFailed(int statusCode);

    [LoggerMessage(EventId = 2006, Level = LogLevel.Error,
        Message = "Token.Refresh.Exception — network error talking to Entra; rejecting principal.")]
    private partial void LogRefreshException(Exception ex);

    /// <summary>
    /// Hook point for <see cref="CookieAuthenticationEvents.OnValidatePrincipal"/>.
    /// Registered via extension method in <see cref="BffAuthenticationSetup"/>.
    /// </summary>
    public async Task ValidateAsync(CookieValidatePrincipalContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var tokens = context.Properties.GetTokens().ToList();
        var accessToken = FindToken(tokens, "access_token");
        var refreshToken = FindToken(tokens, "refresh_token");
        var expiresAtRaw = FindToken(tokens, "expires_at");

        if (accessToken is null || refreshToken is null || expiresAtRaw is null)
        {
            LogMissingTokens();
            _metrics.SessionsRefreshFailed.Add(1, KeyValuePair.Create<string, object?>("reason", "missing_tokens"));
            context.RejectPrincipal();
            return;
        }

        // `expires_at` is written by the OIDC handler as an ISO-8601 string.
        if (!DateTimeOffset.TryParse(expiresAtRaw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var expiresAt))
        {
            LogMissingTokens();
            _metrics.SessionsRefreshFailed.Add(1, KeyValuePair.Create<string, object?>("reason", "missing_tokens"));
            context.RejectPrincipal();
            return;
        }

        var secondsRemaining = (expiresAt - DateTimeOffset.UtcNow).TotalSeconds;
        if (secondsRemaining > RefreshThreshold.TotalSeconds)
        {
            LogRefreshSkip(secondsRemaining, RefreshThreshold.TotalSeconds);
            return;
        }

        LogRefreshAttempt(secondsRemaining);

        var azureAd = _settings.CurrentValue;
        var tokenEndpoint = $"{azureAd.ComputeAuthority()}/oauth2/v2.0/token";

        var body = new List<KeyValuePair<string, string>>
        {
            new("grant_type", "refresh_token"),
            new("client_id", azureAd.ClientId),
            new("client_secret", azureAd.ClientSecret),
            new("refresh_token", refreshToken),
            new("scope", BuildRefreshScopes(azureAd.ApiScope)),
        };

        using var client = _httpClientFactory.CreateClient(HttpClientName);
        using var request = new HttpRequestMessage(HttpMethod.Post, tokenEndpoint)
        {
            Content = new FormUrlEncodedContent(body),
        };

        HttpResponseMessage response;
        try
        {
            response = await client.SendAsync(request, context.HttpContext.RequestAborted).ConfigureAwait(false);
        }
        catch (HttpRequestException ex)
        {
            LogRefreshException(ex);
            _metrics.SessionsRefreshFailed.Add(1, KeyValuePair.Create<string, object?>("reason", "network"));
            context.RejectPrincipal();
            return;
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                LogRefreshFailed((int)response.StatusCode);
                _metrics.SessionsRefreshFailed.Add(1, KeyValuePair.Create<string, object?>("reason", $"http_{(int)response.StatusCode}"));
                context.RejectPrincipal();
                return;
            }

            TokenResponse? payload;
            try
            {
                payload = await response.Content
                    .ReadFromJsonAsync<TokenResponse>(context.HttpContext.RequestAborted)
                    .ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogRefreshException(ex);
                _metrics.SessionsRefreshFailed.Add(1, KeyValuePair.Create<string, object?>("reason", "deserialize"));
                context.RejectPrincipal();
                return;
            }

            if (payload is null || string.IsNullOrEmpty(payload.AccessToken))
            {
                LogRefreshFailed((int)response.StatusCode);
                _metrics.SessionsRefreshFailed.Add(1, KeyValuePair.Create<string, object?>("reason", "empty_payload"));
                context.RejectPrincipal();
                return;
            }

            // Overwrite stashed tokens. Entra may or may not return a new
            // refresh_token — when absent, keep the old one (still valid until
            // the refresh-token family's absolute lifetime expires).
            var newExpiresAt = DateTimeOffset.UtcNow.AddSeconds(payload.ExpiresIn);
            var updatedTokens = new List<AuthenticationToken>
            {
                new() { Name = "access_token", Value = payload.AccessToken },
                new() { Name = "refresh_token", Value = string.IsNullOrEmpty(payload.RefreshToken) ? refreshToken : payload.RefreshToken },
                new() { Name = "expires_at", Value = newExpiresAt.ToString("o", CultureInfo.InvariantCulture) },
            };

            if (!string.IsNullOrEmpty(payload.IdToken))
            {
                updatedTokens.Add(new AuthenticationToken { Name = "id_token", Value = payload.IdToken });
            }

            context.Properties.StoreTokens(updatedTokens);
            context.ShouldRenew = true;
            _metrics.SessionsRefreshed.Add(1);
            LogRefreshSuccess(payload.ExpiresIn);
        }
    }

    private static string? FindToken(List<AuthenticationToken> tokens, string name) =>
        tokens.FirstOrDefault(t => string.Equals(t.Name, name, StringComparison.Ordinal))?.Value;

    /// <summary>
    /// Builds the <c>scope</c> parameter for the refresh-token request. Must
    /// mirror what was asked for at login (minus <c>openid</c> which Entra
    /// handles implicitly for refresh).
    /// </summary>
    private static string BuildRefreshScopes(string apiScope)
    {
        var scopes = new List<string> { "openid", "profile", "offline_access" };
        if (!string.IsNullOrWhiteSpace(apiScope))
        {
            scopes.Add(apiScope);
        }
        return string.Join(' ', scopes);
    }

    /// <summary>
    /// JSON shape returned by Entra's <c>POST /oauth2/v2.0/token</c> endpoint
    /// for a <c>refresh_token</c> grant. Only the fields we consume are
    /// modeled — Entra includes several extras we ignore.
    /// </summary>
    private sealed record TokenResponse
    {
        [System.Text.Json.Serialization.JsonPropertyName("access_token")]
        public string AccessToken { get; init; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("refresh_token")]
        public string? RefreshToken { get; init; }

        [System.Text.Json.Serialization.JsonPropertyName("id_token")]
        public string? IdToken { get; init; }

        [System.Text.Json.Serialization.JsonPropertyName("expires_in")]
        public int ExpiresIn { get; init; }

        [System.Text.Json.Serialization.JsonPropertyName("token_type")]
        public string TokenType { get; init; } = string.Empty;
    }
}
