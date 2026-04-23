namespace Enterprise.Platform.Web.UI.Configuration;

/// <summary>
/// Confidential-client Entra (Azure AD) configuration for the Web.UI host.
/// The Web.UI authenticates users via OIDC Authorization Code + PKCE,
/// receives ID + access + refresh tokens at the callback, and stores them
/// server-side in the cookie ticket. The browser only ever sees a
/// <c>HttpOnly</c>+<c>Secure</c>+<c>SameSite=Strict</c> session cookie.
/// </summary>
/// <remarks>
/// Distinct from <c>Enterprise.Platform.Contracts.Settings.EntraIdSettings</c>
/// (the Api's JWT-validation shape: audiences, issuers, required scopes).
/// Web.UI needs <see cref="ClientSecret"/> + <see cref="CallbackPath"/> +
/// the outbound <see cref="ApiScope"/>; the Api needs none of those. Two
/// separate POCOs let each host evolve its own auth shape without coupling.
/// <para>
/// <b>Secret handling.</b> <see cref="ClientSecret"/> MUST come from
/// <c>dotnet user-secrets</c> in dev or Key Vault in staging/prod — never
/// <c>appsettings.json</c>. <see cref="Setup.PlatformAuthenticationSetup"/>
/// refuses to register the OIDC scheme if <see cref="Enabled"/> is true but
/// the secret is blank, failing loud on a misconfigured deployment.
/// </para>
/// </remarks>
public sealed class AzureAdSettings
{
    /// <summary>Configuration section name — <c>AzureAd</c>.</summary>
    public const string SectionName = "AzureAd";

    /// <summary>
    /// Master switch. <c>false</c> (default in dev before portal setup)
    /// skips OIDC registration entirely; the host behaves as cookie-only and
    /// any protected endpoint returns 401. <c>true</c> activates the full
    /// OIDC code-PKCE flow.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Entra authority host. Defaults to the public cloud; override for
    /// sovereign clouds (e.g. <c>https://login.microsoftonline.us/</c>).
    /// </summary>
    public string Instance { get; set; } = "https://login.microsoftonline.com/";

    /// <summary>
    /// Directory (tenant) id. Use a specific GUID for single-tenant;
    /// <c>common</c> / <c>organizations</c> for multi-tenant.
    /// </summary>
    public string TenantId { get; set; } = string.Empty;

    /// <summary>
    /// Application (client) id of the <b>Web.UI</b> App Registration — NOT the
    /// SPA's client id. We provision a dedicated confidential-client
    /// registration to avoid destructively changing any existing SPA
    /// registration's platform type.
    /// </summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>
    /// Client secret for the Web.UI App Registration. NEVER committed to
    /// source control — supplied via <c>dotnet user-secrets</c> in dev,
    /// Key Vault / pipeline variables in staging/prod. Blank when
    /// <see cref="Enabled"/> is false.
    /// </summary>
    public string ClientSecret { get; set; } = string.Empty;

    /// <summary>
    /// Path where Entra redirects after a successful authorization code
    /// flow. Default matches the ASP.NET OIDC handler's convention; change
    /// only if a reverse proxy rewrites paths. Must be registered verbatim
    /// as a redirect URI on the App Registration.
    /// </summary>
    public string CallbackPath { get; set; } = "/signin-oidc";

    /// <summary>
    /// Path Entra redirects to after a single-sign-out request. Default
    /// matches the ASP.NET OIDC handler's convention.
    /// </summary>
    public string SignedOutCallbackPath { get; set; } = "/signout-callback-oidc";

    /// <summary>
    /// Downstream Api scope the host requests at login — e.g.
    /// <c>api://a703a89e-.../access_as_user</c>. The resulting access token
    /// is stashed in the cookie ticket and swapped onto downstream
    /// <c>/api/proxy/*</c> calls by <see cref="Controllers.ProxyController"/>.
    /// Leave blank to skip API scope acquisition (cookie-only sessions,
    /// useful during early wiring).
    /// </summary>
    public string ApiScope { get; set; } = string.Empty;

    /// <summary>
    /// Cookie session lifetime. The OIDC refresh-token rotation in
    /// <c>OnValidatePrincipal</c> extends this in place as long as Entra
    /// still honors the refresh token; when refresh fails the session is
    /// invalidated and the SPA is redirected back to login.
    /// </summary>
    public TimeSpan SessionLifetime { get; set; } = TimeSpan.FromHours(8);

    /// <summary>
    /// Computed authority URL used by
    /// <see cref="Setup.PlatformAuthenticationSetup"/>:
    /// <c>{Instance}/{TenantId}/v2.0</c>. The v2 endpoint is required for
    /// Entra tokens that carry the <c>scp</c> claim in the modern shape.
    /// </summary>
    /// <returns>e.g. <c>https://login.microsoftonline.com/{tid}/v2.0</c>.</returns>
    public string ComputeAuthority()
    {
        var instance = Instance.TrimEnd('/');
        return $"{instance}/{TenantId}/v2.0";
    }
}
