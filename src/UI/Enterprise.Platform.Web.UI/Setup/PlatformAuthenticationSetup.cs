using System.Security.Claims;
using Enterprise.Platform.Application.Common.Authorization;
using Enterprise.Platform.Web.UI.Configuration;
using Enterprise.Platform.Web.UI.Observability;
using Enterprise.Platform.Web.UI.Services.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using PlatformClaimTypes = Enterprise.Platform.Shared.Constants.ClaimTypes;

namespace Enterprise.Platform.Web.UI.Setup;

/// <summary>
/// Cookie + OIDC authentication for the SPA-facing host.
/// <para>
/// <b>Shape.</b> The host runs the confidential-client
/// Authorization-Code + PKCE flow against Entra: the user is redirected to
/// <c>login.microsoftonline.com</c>, a code is returned to
/// <c>/signin-oidc</c>, the host exchanges it for id + access + refresh
/// tokens, and stashes them in the cookie ticket (<c>SaveTokens = true</c>).
/// The browser never sees a bearer token — only a
/// <c>HttpOnly</c>+<c>Secure</c>+<c>SameSite=Strict</c> session cookie
/// (<see cref="CookieScheme"/>).
/// </para>
/// <para>
/// <b>Enable switch.</b> <c>AzureAd.Enabled</c> gates the OIDC registration.
/// When <c>false</c> the host registers only the cookie scheme, behaves as
/// "always 401 on XHR", and the scaffold stays inert. When <c>true</c> the
/// config is validated loudly: missing ClientSecret, TenantId, or ClientId
/// aborts startup rather than letting the host boot in a broken state.
/// </para>
/// </summary>
public static class PlatformAuthenticationSetup
{
    /// <summary>Cookie scheme name used by the host's session.</summary>
    public const string CookieScheme = "ep.bff";

    /// <summary>OIDC challenge scheme — activated when <c>AzureAd.Enabled</c> is true.</summary>
    public const string OidcScheme = "ep.oidc";

    /// <summary>
    /// <see cref="AuthenticationProperties.Items"/> key the AuthController writes
    /// the validated <c>prompt</c> value to. Consumed by <c>OnRedirectToIdentityProvider</c>
    /// and forwarded as the OIDC <c>prompt</c> request parameter.
    /// </summary>
    public const string PromptPropertyKey = ".ep.bff.prompt";

    /// <summary>Registers cookie auth + (conditionally) OIDC.</summary>
    /// <param name="services">The DI container.</param>
    /// <param name="configuration">App configuration — read synchronously during registration.</param>
    public static IServiceCollection AddPlatformAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var azureAd = configuration
            .GetSection(AzureAdSettings.SectionName)
            .Get<AzureAdSettings>() ?? new AzureAdSettings();

        // Expose the Azure AD settings via IOptions so controllers / services
        // can read the configured ApiScope without re-parsing configuration.
        services.AddOptions<AzureAdSettings>()
            .Bind(configuration.GetSection(AzureAdSettings.SectionName));

        // Refresh-token rotation service. Scoped because it reads request-tied
        // services (ILogger scope, etc.) via the OnValidatePrincipal hook.
        services.AddHttpClient(TokenRefreshService.HttpClientName);
        services.AddScoped<TokenRefreshService>();

        // Session metrics — singleton; underlying Meter is process-wide and
        // instruments are thread-safe.
        services.AddSingleton<SessionMetrics>();

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

    private static void AddCookieScheme(AuthenticationBuilder authBuilder, AzureAdSettings azureAd)
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

            // Refresh-token rotation. Resolved per-request from DI to avoid
            // capturing a singleton HttpClient in the closure. Also tops up
            // the Phase-1 permission claims for cookies that were issued
            // before claim-seeding shipped — without this, existing sessions
            // would 403 on every gated endpoint until the user logged out
            // and back in.
            options.Events.OnValidatePrincipal = async ctx =>
            {
                var refresher = ctx.HttpContext.RequestServices
                    .GetRequiredService<TokenRefreshService>();
                await refresher.ValidateAsync(ctx).ConfigureAwait(false);

                if (TopUpPermissionClaims(ctx.Principal))
                {
                    // Tells the cookie middleware to re-serialise the ticket
                    // so the freshly-added claims persist past this request.
                    ctx.ShouldRenew = true;
                }
            };

            // Session-created metric — fires on each new sign-in (cookie
            // issued). Stash a UTC start-time on the ticket so OnSigningOut
            // can compute lifetime.
            options.Events.OnSigningIn = ctx =>
            {
                ctx.Properties.SetString(
                    SessionStartedAtPropertyKey,
                    DateTimeOffset.UtcNow.UtcTicks.ToString(System.Globalization.CultureInfo.InvariantCulture));

                var metrics = ctx.HttpContext.RequestServices
                    .GetRequiredService<SessionMetrics>();
                metrics.SessionsCreated.Add(1);
                return Task.CompletedTask;
            };

            // Session-lifetime metric — emit the wall-clock seconds the
            // session lived, indexed by reason (`signout` for explicit
            // sign-out, `expired` if SignOut is fired by expiry handling).
            options.Events.OnSigningOut = ctx =>
            {
                var metrics = ctx.HttpContext.RequestServices
                    .GetRequiredService<SessionMetrics>();

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

    private static void AddOidcScheme(AuthenticationBuilder authBuilder, AzureAdSettings azureAd)
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
            // so ProxyController can read them at proxy time via
            // HttpContext.GetTokenAsync("access_token"). The OnValidatePrincipal
            // refresh hook rotates the access token before expiry.
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
            // NOTE: do NOT add `User.Read` (Microsoft Graph) here. Entra
            // returns ONE access_token per request, scoped to ONE resource;
            // mixing the API scope and a Graph scope makes the issued token
            // unusable against whichever resource Entra didn't pick.
            // GraphUserProfileService acquires its own Graph-scoped token on
            // demand via the refresh_token — admin-consented `User.Read` on
            // the App Registration makes that acquisition silent.

            // Claim shape — Entra v2 emits `name` and `roles` directly.
            // Using them avoids the schema-URL claim pile.
            options.TokenValidationParameters.NameClaimType = "name";
            options.TokenValidationParameters.RoleClaimType = "roles";

            // Dev convenience — OIDC requires HTTPS *except* for localhost
            // loopback. Leaving RequireHttpsMetadata on lets us catch an
            // accidentally-exposed non-loopback HTTP hostname early.
            options.RequireHttpsMetadata = true;

            options.Events = new OpenIdConnectEvents
            {
                // Phase-1 cookie-claim seeding. Entra returns identity / role
                // claims but never the platform's fine-grained
                // `ep:permission` claims that endpoint policies consume. Add
                // them here so every freshly-issued cookie carries the
                // canonical Phase-1 grant; Phase 2 swaps the static list for
                // a per-user SQL lookup. Same source-of-truth as the SPA's
                // `AuthStore.hydrate` consumes (see <see cref="Phase1Permissions"/>).
                OnTokenValidated = ctx =>
                {
                    TopUpPermissionClaims(ctx.Principal);
                    return Task.CompletedTask;
                },

                // Localhost redirect URIs register as http://localhost:<port>/signin-oidc
                // on the App Registration. When the host runs under http://
                // (dev default), the handler must not force https on the
                // outbound authorize URL — Entra validates the redirect_uri
                // against what's registered.
                //
                // Also forwards the AuthController-supplied `prompt` parameter
                // (validated against an allowlist there) so account-switcher
                // / forced re-auth UX works without repeating the validation
                // logic in the event handler.
                OnRedirectToIdentityProvider = ctx =>
                {
                    if (ctx.Request.Host.Host is "localhost" or "127.0.0.1")
                    {
                        ctx.ProtocolMessage.RedirectUri = BuildLocalhostRedirect(
                            ctx.Request.Host.ToString(),
                            ctx.Request.PathBase,
                            azureAd.CallbackPath);
                    }

                    if (ctx.Properties.Items.TryGetValue(PromptPropertyKey, out var prompt)
                        && !string.IsNullOrWhiteSpace(prompt))
                    {
                        ctx.ProtocolMessage.Prompt = prompt;
                    }

                    return Task.CompletedTask;
                },

                // Logout strengthening: include `id_token_hint` on the
                // end-session redirect so Entra knows which session to
                // terminate without showing an account-picker. Falls back
                // to an empty hint if the id_token isn't stashed (e.g.
                // session is corrupt) — Entra still terminates whichever
                // session matches the cookie, just less precisely.
                OnRedirectToIdentityProviderForSignOut = async ctx =>
                {
                    var idToken = await ctx.HttpContext
                        .GetTokenAsync(CookieScheme, "id_token")
                        .ConfigureAwait(false);
                    if (!string.IsNullOrEmpty(idToken))
                    {
                        ctx.ProtocolMessage.IdTokenHint = idToken;
                    }
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

    /// <summary>
    /// Adds the Phase-1 <c>ep:permission</c> claims to <paramref name="principal"/>
    /// when they're absent. Idempotent — never adds duplicates. Returns
    /// <c>true</c> when claims were added (so the caller can flag the cookie
    /// for re-serialisation).
    /// </summary>
    /// <remarks>
    /// <para>
    /// Called from two places:
    /// <list type="bullet">
    ///   <item><c>OnTokenValidated</c> — fresh login, principal lacks every
    ///     <c>ep:permission</c>, all are added.</item>
    ///   <item><c>OnValidatePrincipal</c> — every authenticated request,
    ///     covers cookies issued before claim-seeding shipped (no logout
    ///     required to recover).</item>
    /// </list>
    /// </para>
    /// <para>
    /// Phase 2 swaps the static <see cref="Phase1Permissions.All"/> for a
    /// per-user SQL lookup; the public surface of this helper stays the
    /// same so the call-sites don't change.
    /// </para>
    /// </remarks>
    private static bool TopUpPermissionClaims(ClaimsPrincipal? principal)
    {
        if (principal?.Identity is not ClaimsIdentity identity)
        {
            return false;
        }

        var existing = identity.FindAll(PlatformClaimTypes.Permission)
            .Select(c => c.Value)
            .ToHashSet(StringComparer.Ordinal);

        var added = false;
        foreach (var permission in Phase1Permissions.All)
        {
            if (existing.Add(permission))
            {
                identity.AddClaim(new Claim(PlatformClaimTypes.Permission, permission));
                added = true;
            }
        }

        return added;
    }

    // ── config validation ──────────────────────────────────────────────

    /// <summary>
    /// Validates OIDC config loudly at startup. Failing here beats booting
    /// with a half-wired AddOpenIdConnect that would throw cryptic
    /// <c>IDX20803</c> / <c>AADSTS</c> errors on the first login attempt.
    /// </summary>
    private static void ValidateOidcConfig(AzureAdSettings azureAd)
    {
        List<string>? missing = null;

        if (string.IsNullOrWhiteSpace(azureAd.TenantId))
        {
            (missing ??= []).Add($"{AzureAdSettings.SectionName}:TenantId");
        }
        if (string.IsNullOrWhiteSpace(azureAd.ClientId))
        {
            (missing ??= []).Add($"{AzureAdSettings.SectionName}:ClientId");
        }
        if (string.IsNullOrWhiteSpace(azureAd.ClientSecret))
        {
            (missing ??= []).Add(
                $"{AzureAdSettings.SectionName}:ClientSecret " +
                "(use `dotnet user-secrets set \"AzureAd:ClientSecret\" <value>` in dev; " +
                "never commit to appsettings.json)");
        }

        if (missing is { Count: > 0 })
        {
            throw new InvalidOperationException(
                $"OIDC is enabled but required AzureAd configuration is missing:{Environment.NewLine}" +
                string.Join(Environment.NewLine, missing.Select(m => $"  - {m}")));
        }
    }
}
