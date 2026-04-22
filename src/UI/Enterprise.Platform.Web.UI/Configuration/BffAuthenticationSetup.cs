using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace Enterprise.Platform.Web.UI.Configuration;

/// <summary>
/// Cookie + OIDC authentication for the SPA-facing BFF.
/// <para>
/// <b>Shape.</b> The BFF runs the confidential-client
/// Authorization-Code + PKCE flow against Entra: the user is redirected to
/// <c>login.microsoftonline.com</c>, a code is returned to
/// <c>/signin-oidc</c>, the BFF exchanges it for id + access + refresh
/// tokens, and stashes them in the cookie ticket (<c>SaveTokens = true</c>).
/// The browser never sees a bearer token — only a
/// <c>HttpOnly</c>+<c>Secure</c>+<c>SameSite=Strict</c> session cookie
/// (<see cref="CookieScheme"/>).
/// </para>
/// <para>
/// <b>Enable switch.</b> <c>AzureAd.Enabled</c> gates the OIDC registration.
/// When <c>false</c> the BFF registers only the cookie scheme, behaves as
/// "always 401 on XHR", and the scaffold stays inert — convenient while
/// Phase 9 A1 (App Registration provisioning) is in flight. When
/// <c>true</c> the config is validated loudly: missing ClientSecret,
/// TenantId, or ClientId aborts startup rather than letting the BFF boot
/// in a broken state.
/// </para>
/// </summary>
public static class BffAuthenticationSetup
{
    /// <summary>Cookie scheme name used by the BFF session.</summary>
    public const string CookieScheme = "ep.bff";

    /// <summary>OIDC challenge scheme — activated when <c>AzureAd.Enabled</c> is true.</summary>
    public const string OidcScheme = "ep.oidc";

    /// <summary>Registers cookie auth + (conditionally) OIDC.</summary>
    /// <param name="services">The DI container.</param>
    /// <param name="configuration">App configuration — read synchronously during registration.</param>
    public static IServiceCollection AddBffAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var azureAd = configuration
            .GetSection(AzureAdBffSettings.SectionName)
            .Get<AzureAdBffSettings>() ?? new AzureAdBffSettings();

        // Expose the BFF's Azure AD settings via IOptions so controllers
        // (AuthController in B3) can read the configured ApiScope without
        // re-parsing configuration.
        services.AddOptions<AzureAdBffSettings>()
            .Bind(configuration.GetSection(AzureAdBffSettings.SectionName));

        // Refresh-token rotation service (B7). Scoped because it reads
        // request-tied services (ILogger scope, etc.) via the hook.
        services.AddHttpClient(BffTokenRefreshService.HttpClientName);
        services.AddScoped<BffTokenRefreshService>();

        // Session metrics (Phase 9.F.2). Singleton — the underlying Meter is
        // process-wide; instruments are thread-safe.
        services.AddSingleton<BffSessionMetrics>();

        var authBuilder = services.AddAuthentication(options =>
        {
            options.DefaultScheme = CookieScheme;
            options.DefaultSignInScheme = CookieScheme;
            // When OIDC is disabled, unauthenticated XHRs get 401 via the
            // OnRedirectToLogin event below. When enabled, the challenge
            // triggers a redirect to Entra.
            if (azureAd.Enabled)
            {
                options.DefaultChallengeScheme = OidcScheme;
            }
        });

        AddCookieScheme(authBuilder, azureAd);

        if (azureAd.Enabled)
        {
            ValidateOidcConfig(azureAd);
            AddOidcScheme(authBuilder, azureAd);
        }

        services.AddAuthorization();

        return services;
    }

    // ── cookie session ──────────────────────────────────────────────────

    /// <summary>
    /// Authentication-property key used to stash the session start instant
    /// (UTC ticks as string). Read on sign-out to record the session-lifetime
    /// histogram bucket.
    /// </summary>
    private const string SessionStartedAtPropertyKey = ".ep.bff.session_started_at";

    private static void AddCookieScheme(AuthenticationBuilder authBuilder, AzureAdBffSettings azureAd)
    {
        authBuilder.AddCookie(CookieScheme, options =>
        {
            options.Cookie.Name = "ep.bff.session";
            options.Cookie.HttpOnly = true;
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.SlidingExpiration = true;
            options.ExpireTimeSpan = azureAd.SessionLifetime;

            // SPA-friendly — no HTML redirects on unauthenticated XHRs.
            // The SPA's HTTP interceptor treats a 401 as "kick to login".
            options.Events.OnRedirectToLogin = ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };

            // Refresh-token rotation (B7). Resolved per-request from DI to
            // avoid capturing a singleton HttpClient in the closure.
            options.Events.OnValidatePrincipal = async ctx =>
            {
                var refresher = ctx.HttpContext.RequestServices
                    .GetRequiredService<BffTokenRefreshService>();
                await refresher.ValidateAsync(ctx).ConfigureAwait(false);
            };

            // Session-created metric (9.F.2) — fires on each new sign-in
            // (cookie issued). Stash a UTC start-time on the ticket so
            // OnSigningOut can compute lifetime.
            options.Events.OnSigningIn = ctx =>
            {
                ctx.Properties.SetString(
                    SessionStartedAtPropertyKey,
                    DateTimeOffset.UtcNow.UtcTicks.ToString(System.Globalization.CultureInfo.InvariantCulture));

                var metrics = ctx.HttpContext.RequestServices
                    .GetRequiredService<BffSessionMetrics>();
                metrics.SessionsCreated.Add(1);
                return Task.CompletedTask;
            };

            // Session-lifetime metric — emit the wall-clock seconds the
            // session lived, indexed by reason (`signout` for explicit
            // sign-out, `expired` if SignOut is fired by expiry handling).
            options.Events.OnSigningOut = ctx =>
            {
                var metrics = ctx.HttpContext.RequestServices
                    .GetRequiredService<BffSessionMetrics>();

                var startedAtRaw = ctx.Properties.GetString(SessionStartedAtPropertyKey);
                if (long.TryParse(startedAtRaw, System.Globalization.NumberStyles.Integer,
                    System.Globalization.CultureInfo.InvariantCulture, out var startedAtTicks))
                {
                    var lifetime = DateTimeOffset.UtcNow - new DateTimeOffset(startedAtTicks, TimeSpan.Zero);
                    metrics.SessionLifetimeSeconds.Record(
                        lifetime.TotalSeconds,
                        KeyValuePair.Create<string, object?>("reason", "signout"));
                }

                return Task.CompletedTask;
            };
        });
    }

    // ── OIDC code + PKCE flow ──────────────────────────────────────────

    private static void AddOidcScheme(AuthenticationBuilder authBuilder, AzureAdBffSettings azureAd)
    {
        authBuilder.AddOpenIdConnect(OidcScheme, options =>
        {
            options.Authority = azureAd.ComputeAuthority();
            options.ClientId = azureAd.ClientId;
            options.ClientSecret = azureAd.ClientSecret;
            options.CallbackPath = azureAd.CallbackPath;
            options.SignedOutCallbackPath = azureAd.SignedOutCallbackPath;

            // Code + PKCE (confidential client). ID token alone (hybrid flow)
            // is insufficient — we need the access_token + refresh_token.
            options.ResponseType = OpenIdConnectResponseType.Code;
            options.UsePkce = true;
            options.ResponseMode = OpenIdConnectResponseMode.FormPost;

            // Persist the id/access/refresh tokens inside the cookie ticket
            // so BffProxyController can read them at proxy time via
            // HttpContext.GetTokenAsync("access_token"). The OnValidatePrincipal
            // refresh hook (wired in B7) rotates the access token before expiry.
            options.SaveTokens = true;

            // v2 endpoint carries everything we need — skip the extra round-trip.
            options.GetClaimsFromUserInfoEndpoint = false;

            options.Scope.Clear();
            options.Scope.Add("openid");
            options.Scope.Add("profile");
            options.Scope.Add("offline_access"); // required for refresh_token issuance
            if (!string.IsNullOrWhiteSpace(azureAd.ApiScope))
            {
                options.Scope.Add(azureAd.ApiScope);
            }

            // Claim shape — Entra v2 emits `name` and `roles` directly.
            // Using them avoids the schema-URL claim pile we saw in Phase 7.6.
            options.TokenValidationParameters.NameClaimType = "name";
            options.TokenValidationParameters.RoleClaimType = "roles";

            // Dev convenience — OIDC requires HTTPS *except* for localhost
            // loopback. Leaving RequireHttpsMetadata on lets us catch an
            // accidentally-exposed non-loopback HTTP hostname early.
            options.RequireHttpsMetadata = true;

            options.Events = new OpenIdConnectEvents
            {
                // Localhost redirect URIs register as http://localhost:<port>/signin-oidc
                // on the App Registration. When the BFF runs under http://
                // (dev default), the handler must not force https on the
                // outbound authorize URL — Entra validates the redirect_uri
                // against what's registered.
                OnRedirectToIdentityProvider = ctx =>
                {
                    if (ctx.Request.Host.Host is "localhost" or "127.0.0.1")
                    {
                        ctx.ProtocolMessage.RedirectUri = BuildLocalhostRedirect(
                            ctx.Request.Host.ToString(),
                            ctx.Request.PathBase,
                            azureAd.CallbackPath);
                    }
                    return Task.CompletedTask;
                },

                // Surface auth failures as structured 401s — the SPA will
                // redirect back to /api/auth/login, triggering a fresh flow.
                OnAuthenticationFailed = ctx =>
                {
                    ctx.HandleResponse();
                    ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    ctx.Response.ContentType = "application/json";
                    return ctx.Response.WriteAsync(
                        """{"title":"Authentication failed","detail":"OIDC flow aborted; retry login."}""");
                },
            };
        });
    }

    private static string BuildLocalhostRedirect(string host, PathString pathBase, string callbackPath)
    {
        var prefix = pathBase.HasValue ? pathBase.Value : string.Empty;
        return $"http://{host}{prefix}{callbackPath}";
    }

    // ── config validation ──────────────────────────────────────────────

    /// <summary>
    /// Validates OIDC config loudly at startup. Failing here beats booting
    /// with a half-wired AddOpenIdConnect that would throw cryptic
    /// <c>IDX20803</c> / <c>AADSTS</c> errors on the first login attempt.
    /// </summary>
    private static void ValidateOidcConfig(AzureAdBffSettings azureAd)
    {
        List<string>? missing = null;

        if (string.IsNullOrWhiteSpace(azureAd.TenantId))
        {
            (missing ??= []).Add($"{AzureAdBffSettings.SectionName}:TenantId");
        }
        if (string.IsNullOrWhiteSpace(azureAd.ClientId))
        {
            (missing ??= []).Add($"{AzureAdBffSettings.SectionName}:ClientId");
        }
        if (string.IsNullOrWhiteSpace(azureAd.ClientSecret))
        {
            (missing ??= []).Add(
                $"{AzureAdBffSettings.SectionName}:ClientSecret " +
                "(use `dotnet user-secrets set \"AzureAd:ClientSecret\" <value>` in dev; " +
                "never commit to appsettings.json)");
        }

        if (missing is { Count: > 0 })
        {
            throw new InvalidOperationException(
                $"BFF OIDC is enabled but required AzureAd configuration is missing:{Environment.NewLine}" +
                string.Join(Environment.NewLine, missing.Select(m => $"  - {m}")));
        }
    }
}
