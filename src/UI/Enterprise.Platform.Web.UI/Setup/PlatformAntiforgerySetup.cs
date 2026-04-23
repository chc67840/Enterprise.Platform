namespace Enterprise.Platform.Web.UI.Setup;

/// <summary>
/// Anti-forgery (CSRF) protection for SPA-originated mutating requests.
/// Issues two cookies:
/// <list type="bullet">
///   <item><c>__RequestVerificationToken</c> — HttpOnly, server-validated token.</item>
///   <item><c>XSRF-TOKEN</c> — JS-readable cookie, set explicitly by
///         <see cref="Controllers.AntiforgeryController"/> at session start.
///         Angular's built-in <c>HttpXsrfInterceptor</c> reads this and echoes
///         the value as <c>X-XSRF-TOKEN</c> on every mutating XHR.</item>
/// </list>
/// Validated by <c>[AutoValidateAntiforgeryToken]</c> on
/// <see cref="Controllers.ProxyController"/>.
/// </summary>
public static class PlatformAntiforgerySetup
{
    /// <summary>
    /// Header name the SPA uses to echo the XSRF token. Matches Angular's
    /// <c>HttpXsrfInterceptor</c> default.
    /// </summary>
    public const string HeaderName = "X-XSRF-TOKEN";

    /// <summary>HttpOnly server-validated cookie name (NOT the JS-readable one).</summary>
    public const string CookieName = "__RequestVerificationToken";

    /// <summary>Registers anti-forgery services with the SPA-friendly defaults.</summary>
    /// <param name="services">The DI container.</param>
    /// <param name="environment">
    /// Used to choose the cookie's <c>SecurePolicy</c>: <c>Always</c> in prod
    /// (HTTPS required) / <c>SameAsRequest</c> in dev so plain-HTTP
    /// <c>dotnet run</c> still works without a dev-cert dance. The same
    /// policy is applied to the host's session cookie inside
    /// <see cref="PlatformAuthenticationSetup"/>.
    /// </param>
    public static IServiceCollection AddPlatformAntiforgery(
        this IServiceCollection services,
        IWebHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(environment);

        var cookieSecurePolicy = environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;

        services.AddAntiforgery(options =>
        {
            options.HeaderName = HeaderName;
            options.Cookie.Name = CookieName;
            options.Cookie.HttpOnly = true;
            options.Cookie.SecurePolicy = cookieSecurePolicy;
            options.Cookie.SameSite = SameSiteMode.Strict;
        });

        return services;
    }
}
