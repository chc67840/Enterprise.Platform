namespace Enterprise.Platform.Contracts.Settings;

/// <summary>
/// Azure Entra ID (B2B / Azure AD) settings. The SPA authenticates against Entra
/// via MSAL.js and presents bearer tokens to the Api; <b>the Api never issues
/// tokens</b>, it only validates them. Bound from the <c>AzureAd</c> section — the
/// name matches Microsoft's conventions so <c>Microsoft.Identity.Web</c>'s extension
/// methods pick it up unmodified.
/// </summary>
public sealed class EntraIdSettings
{
    /// <summary>Configuration section name — <c>AzureAd</c>.</summary>
    public const string SectionName = "AzureAd";

    /// <summary>When <c>false</c>, the Entra scheme is skipped (dev path uses the symmetric-key fallback).</summary>
    public bool Enabled { get; set; }

    /// <summary>Authority instance (e.g. <c>https://login.microsoftonline.com/</c>).</summary>
    public string Instance { get; set; } = "https://login.microsoftonline.com/";

    /// <summary>
    /// Tenant id. Use <c>"common"</c> for multi-tenant apps that accept any
    /// Microsoft identity, <c>"organizations"</c> for work/school only, or a
    /// specific tenant Guid for single-tenant.
    /// </summary>
    public string TenantId { get; set; } = "common";

    /// <summary>Application (client) id of the API registration in Entra.</summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>
    /// Audiences the token must be issued for. Typically the API's client id or a
    /// custom identifier URI. Multiple entries let the Api accept tokens minted for
    /// either the SPA or the BFF.
    /// </summary>
    public IReadOnlyList<string> Audiences { get; set; } = [];

    /// <summary>
    /// Explicit issuer allow-list. <b>Critical when <see cref="TenantId"/> is <c>"common"</c></b>
    /// or <c>"organizations"</c> — otherwise tokens from any Microsoft tenant are
    /// accepted. Populate with the issuer URLs of every tenant you want to trust.
    /// </summary>
    public IReadOnlyList<string> AllowedIssuers { get; set; } = [];

    /// <summary>
    /// Scopes the token must declare (<c>scp</c> claim). Populate with the API's
    /// exposed scopes (e.g. <c>api://{client-id}/access_as_user</c>).
    /// </summary>
    public IReadOnlyList<string> RequiredScopes { get; set; } = [];

    /// <summary>
    /// Claim that carries the Entra tenant id. Default <c>tid</c>. Consumed by the
    /// tenant mapping hook to derive the platform tenant id.
    /// </summary>
    public string TenantIdClaim { get; set; } = "tid";

    /// <summary>
    /// Mapping from Entra tenant id (string-serialised Guid) to the platform's
    /// tenant id. The auth pipeline emits a derived <c>ep:tenant_id</c> claim using
    /// this table so <c>CurrentTenantService</c> returns the platform id even when
    /// the token carries only the Entra id.
    /// </summary>
    public IReadOnlyDictionary<string, Guid> PlatformTenantMapping { get; set; }
        = new Dictionary<string, Guid>(StringComparer.Ordinal);
}
