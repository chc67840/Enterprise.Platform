using System.Net.Http.Headers;
using System.Net.Http.Json;
using Enterprise.Platform.Web.UI.Configuration;
using Enterprise.Platform.Web.UI.Services.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Web.UI.Services.Graph;

/// <summary>
/// Fetches the signed-in user's Microsoft Graph <c>/me</c> profile (display
/// name, job title, mail, office, etc.). Uses the host's stashed refresh
/// token to mint a Graph-scoped access token on demand — the host's primary
/// access token is audience-scoped to the platform Api, so a separate token
/// acquisition is required for Graph.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why on the server, not the SPA.</b> Graph requires a bearer token. The
/// SPA is cookie-session-only post-Phase-9; pushing token-acquisition logic
/// into the browser would re-open the very door we closed. Server-side
/// fetching keeps the bearer surface entirely host-internal.
/// </para>
/// <para>
/// <b>Caching.</b> Profiles change rarely (job title, name) — a 5-minute
/// per-user cache slashes Graph calls without staleness risk. Cache key
/// derives from the <c>oid</c> / <c>sub</c> claim (stable per Entra account).
/// </para>
/// <para>
/// <b>Token acquisition path.</b> POSTs <c>grant_type=refresh_token</c> with
/// <c>scope=https://graph.microsoft.com/User.Read</c> to Entra's v2 token
/// endpoint. The refresh-token isn't audience-scoped, so it can mint tokens
/// for any consented scope. <c>User.Read</c> is admin-consented at the
/// App Registration level so the on-demand acquisition is silent.
/// </para>
/// </remarks>
public sealed partial class GraphUserProfileService(
    IHttpClientFactory httpClientFactory,
    IOptionsMonitor<AzureAdSettings> settings,
    IMemoryCache cache,
    ILogger<GraphUserProfileService> logger)
{
    /// <summary>Named HTTP client used for the Entra token-exchange call.</summary>
    public const string TokenHttpClientName = "ep-graph-token";

    /// <summary>Named HTTP client used for the Microsoft Graph API call.</summary>
    public const string GraphHttpClientName = "ep-graph";

    /// <summary>Cache TTL — long enough to absorb chatty SPA polls, short enough to surface profile updates same-day.</summary>
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    private readonly IHttpClientFactory _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
    private readonly IOptionsMonitor<AzureAdSettings> _settings = settings ?? throw new ArgumentNullException(nameof(settings));
    private readonly IMemoryCache _cache = cache ?? throw new ArgumentNullException(nameof(cache));
    private readonly ILogger<GraphUserProfileService> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    [LoggerMessage(EventId = 5001, Level = LogLevel.Debug,
        Message = "Graph.Profile.CacheHit — sub={Sub} (TTL: {TtlSeconds}s)")]
    private partial void LogCacheHit(string sub, double ttlSeconds);

    [LoggerMessage(EventId = 5002, Level = LogLevel.Information,
        Message = "Graph.Profile.Fetched — sub={Sub} (cached for {TtlSeconds}s)")]
    private partial void LogFetched(string sub, double ttlSeconds);

    [LoggerMessage(EventId = 5003, Level = LogLevel.Warning,
        Message = "Graph.Token.Failed — Entra returned {StatusCode}; cannot fetch Graph profile.")]
    private partial void LogTokenFailed(int statusCode);

    [LoggerMessage(EventId = 5004, Level = LogLevel.Warning,
        Message = "Graph.Profile.Failed — Graph returned {StatusCode}; falling back to session claims.")]
    private partial void LogProfileFailed(int statusCode);

    [LoggerMessage(EventId = 5005, Level = LogLevel.Warning,
        Message = "Graph.Token.MissingRefreshToken — session has no refresh_token; cannot reach Graph.")]
    private partial void LogMissingRefreshToken();

    /// <summary>
    /// Returns the Graph profile of the currently-authenticated user, or
    /// <c>null</c> when no session OR Graph is unreachable. Network failures
    /// are logged + swallowed — callers should fall back to session-claim
    /// data (name/email from the session DTO).
    /// </summary>
    public async Task<GraphUserProfile?> GetCurrentUserAsync(HttpContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.User.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        var sub = context.User.FindFirst("oid")?.Value
            ?? context.User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(sub))
        {
            return null;
        }

        var cacheKey = $"graph:profile:{sub}";
        if (_cache.TryGetValue(cacheKey, out GraphUserProfile? cached) && cached is not null)
        {
            LogCacheHit(sub, CacheTtl.TotalSeconds);
            return cached;
        }

        var graphToken = await AcquireGraphTokenAsync(context, cancellationToken).ConfigureAwait(false);
        if (graphToken is null)
        {
            return null;
        }

        var profile = await FetchProfileAsync(graphToken, cancellationToken).ConfigureAwait(false);
        if (profile is not null)
        {
            _cache.Set(cacheKey, profile, CacheTtl);
            LogFetched(sub, CacheTtl.TotalSeconds);
        }

        return profile;
    }

    private async Task<string?> AcquireGraphTokenAsync(HttpContext context, CancellationToken cancellationToken)
    {
        var refreshToken = await context.GetTokenAsync(Setup.PlatformAuthenticationSetup.CookieScheme, "refresh_token").ConfigureAwait(false);
        if (string.IsNullOrEmpty(refreshToken))
        {
            LogMissingRefreshToken();
            return null;
        }

        var azureAd = _settings.CurrentValue;
        var tokenEndpoint = $"{azureAd.ComputeAuthority()}/oauth2/v2.0/token";

        var body = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("grant_type", "refresh_token"),
            new KeyValuePair<string, string>("client_id", azureAd.ClientId),
            new KeyValuePair<string, string>("client_secret", azureAd.ClientSecret),
            new KeyValuePair<string, string>("refresh_token", refreshToken),
            new KeyValuePair<string, string>("scope", GraphConstants.UserReadScope),
        });

        using var http = _httpClientFactory.CreateClient(TokenHttpClientName);
        using var response = await http.PostAsync(tokenEndpoint, body, cancellationToken).ConfigureAwait(false);

        if (!response.IsSuccessStatusCode)
        {
            LogTokenFailed((int)response.StatusCode);
            return null;
        }

        var payload = await response.Content
            .ReadFromJsonAsync<EntraTokenResponse>(cancellationToken)
            .ConfigureAwait(false);
        return payload?.AccessToken;
    }

    private async Task<GraphUserProfile?> FetchProfileAsync(string accessToken, CancellationToken cancellationToken)
    {
        using var http = _httpClientFactory.CreateClient(GraphHttpClientName);
        using var request = new HttpRequestMessage(HttpMethod.Get, GraphConstants.MeEndpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var response = await http.SendAsync(request, cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            LogProfileFailed((int)response.StatusCode);
            return null;
        }

        return await response.Content
            .ReadFromJsonAsync<GraphUserProfile>(cancellationToken)
            .ConfigureAwait(false);
    }
}
