namespace Enterprise.Platform.Web.UI.Configuration;

/// <summary>
/// Configures the dev-time SPA reverse proxy. The BFF reverse-proxies any
/// unmatched HTTP request (i.e. anything not handled by a controller or the
/// OIDC middleware) to the Angular dev server during <c>Development</c>;
/// in other environments <c>wwwroot/</c> serves the built SPA directly.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why this exists.</b> The BFF must be the single browser-visible origin
/// so cookies (session + XSRF) ride every request without cross-origin
/// exemptions. Angular dev server's HMR ergonomics stay intact by running it
/// on its usual <c>:4200</c> internally; the browser only ever sees
/// <c>:5001</c>.
/// </para>
/// <para>
/// <b>Scope.</b> HTTP only. HMR WebSockets (Vite / esbuild) are NOT forwarded
/// through <c>:5001</c>; developers wanting HMR iterate directly against
/// <c>:4200</c> for pure-UI changes and use <c>:5001</c> only when testing
/// auth + API integration.
/// </para>
/// </remarks>
public sealed class BffSpaSettings
{
    /// <summary>Configuration section name — <c>Bff:Spa</c>.</summary>
    public const string SectionName = "Bff:Spa";

    /// <summary>
    /// Master switch. <c>true</c> in <c>Development</c> activates the dev
    /// reverse proxy to <see cref="UpstreamUri"/>. <c>false</c> (default in
    /// non-dev environments) serves <c>wwwroot/</c> via static files and the
    /// SPA-fallback index.html rewrite.
    /// </summary>
    public bool UseDevProxy { get; set; }

    /// <summary>
    /// Angular dev server URI. Accessed only when <see cref="UseDevProxy"/> is
    /// <c>true</c>. Must match the port configured in the SPA project's
    /// <c>angular.json</c> / <c>proxy.conf.json</c>.
    /// </summary>
    public string UpstreamUri { get; set; } = "http://localhost:4200";

    /// <summary>
    /// Per-request timeout for forwarded calls. Keep generous — first-load
    /// Angular chunks can be slow under cold build. Has no effect when
    /// <see cref="UseDevProxy"/> is <c>false</c>.
    /// </summary>
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(60);
}
