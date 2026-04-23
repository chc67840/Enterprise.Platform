namespace Enterprise.Platform.Web.UI.Configuration;

/// <summary>
/// Configures how the BFF serves the Angular SPA. Static-root mode: the BFF
/// serves built SPA assets directly from <see cref="StaticRoot"/> via ASP.NET's
/// static-file middleware. Dev workflow uses <c>npm run watch</c> which writes
/// to <c>dist/&lt;app&gt;/browser</c>; prod deploys copy that output into the
/// project's <c>wwwroot/</c> at build time.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why static-files-only.</b> The BFF must be the single browser-visible
/// origin so cookies (session + XSRF) ride every request without cross-origin
/// exemptions. Serving the SPA directly (vs. proxying to an Angular dev
/// server) is prod-parity, requires no second process, and removes the
/// dev/prod behaviour drift a proxy mode would introduce.
/// </para>
/// </remarks>
public sealed class BffSpaSettings
{
    /// <summary>Configuration section name — <c>Bff:Spa</c>.</summary>
    public const string SectionName = "Bff:Spa";

    /// <summary>
    /// Filesystem path containing the built SPA (typically Angular's
    /// <c>dist/&lt;project&gt;/browser/</c> output). Resolved relative to
    /// <see cref="IWebHostEnvironment.ContentRootPath"/> when not absolute.
    /// <para>
    /// When non-empty, the BFF:
    /// </para>
    /// <list type="bullet">
    ///   <item>Configures <c>UseStaticFiles</c> with a <c>PhysicalFileProvider</c>
    ///         pointing at this path, so <c>/main.js</c>, <c>/styles.css</c>,
    ///         <c>/assets/*</c>, etc. are served straight from disk.</item>
    ///   <item>Serves <c>index.html</c> from this path on the SPA fallback
    ///         (any unmatched route — Angular's router resolves it client-side).</item>
    /// </list>
    /// Empty falls back to the standard <c>WebRootPath</c> (i.e.
    /// <c>wwwroot/</c>) — the standard prod layout where <c>ng build</c>
    /// output is copied into <c>wwwroot/</c> at deploy time.
    /// </summary>
    public string StaticRoot { get; set; } = string.Empty;
}
