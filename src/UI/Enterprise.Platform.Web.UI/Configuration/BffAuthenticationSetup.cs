using Microsoft.AspNetCore.Authentication.Cookies;

namespace Enterprise.Platform.Web.UI.Configuration;

/// <summary>
/// Cookie-session authentication for the SPA-facing BFF. The browser gets a
/// <c>HttpOnly</c> + <c>Secure</c> + <c>SameSite=Strict</c> cookie; the BFF holds the
/// downstream Api bearer token inside the session (or the user's ticket properties)
/// and swaps it in at proxy time. OIDC callback handling + refresh-token rotation
/// are **deferred with D4** — their wiring (commented) lives next to the cookie
/// scheme below so the activation diff is trivial once <c>TokenService</c> +
/// PlatformDb refresh-token store land.
/// </summary>
public static class BffAuthenticationSetup
{
    /// <summary>Cookie scheme name used by the BFF session.</summary>
    public const string CookieScheme = "ep.bff";

    /// <summary>OIDC challenge scheme — referenced in commented hookup below; activates with D4.</summary>
    public const string OidcScheme = "ep.oidc";

    /// <summary>Registers cookie auth (+ placeholder OIDC challenge hookup).</summary>
    public static IServiceCollection AddBffAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var authBuilder = services.AddAuthentication(options =>
        {
            options.DefaultScheme = CookieScheme;
            // options.DefaultChallengeScheme = OidcScheme;   // activate with D4
        });

        authBuilder.AddCookie(CookieScheme, options =>
        {
            options.Cookie.Name = "ep.bff.session";
            options.Cookie.HttpOnly = true;
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.SlidingExpiration = true;
            options.ExpireTimeSpan = TimeSpan.FromMinutes(60);

            // SPA-friendly defaults: no redirects on unauthenticated XHRs — return 401.
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
        });

        // -------------------------------------------------------------------
        // OIDC challenge (deferred with D4). Expected shape once TokenService +
        // the platform identity provider are online:
        //
        //   authBuilder.AddOpenIdConnect(OidcScheme, options =>
        //   {
        //       options.Authority = "https://auth.enterprise-platform.local";
        //       options.ClientId = configuration["Bff:Oidc:ClientId"];
        //       options.ClientSecret = configuration["Bff:Oidc:ClientSecret"];
        //       options.ResponseType = "code";
        //       options.Scope.Add("openid"); options.Scope.Add("profile"); options.Scope.Add("offline_access");
        //       options.SaveTokens = true;           // stash refresh token in the cookie ticket
        //       options.GetClaimsFromUserInfoEndpoint = true;
        //   });
        // -------------------------------------------------------------------

        services.AddAuthorization();

        return services;
    }
}
