namespace Enterprise.Platform.Contracts.Settings;

/// <summary>
/// Azure Entra ID B2C settings — consumer-facing identities (sign-up / sign-in
/// policies, custom branded flows). Bound from <c>AzureAdB2C</c> so Microsoft's
/// `Microsoft.Identity.Web` extensions pick it up unmodified. B2C tokens are issued
/// by the B2C tenant's authority; the Api runs a second JWT bearer scheme keyed
/// against this configuration alongside the B2B scheme in
/// <see cref="EntraIdSettings"/>.
/// </summary>
public sealed class EntraIdB2CSettings
{
    /// <summary>Configuration section name — <c>AzureAdB2C</c>.</summary>
    public const string SectionName = "AzureAdB2C";

    /// <summary>When <c>false</c>, B2C validation is skipped.</summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Tenant-specific authority instance. Typically
    /// <c>https://{tenant}.b2clogin.com/</c>. The <c>{tenant}</c> placeholder is
    /// substituted from <see cref="Domain"/>'s first segment.
    /// </summary>
    public string Instance { get; set; } = string.Empty;

    /// <summary>Fully-qualified B2C domain (e.g. <c>contosob2c.onmicrosoft.com</c>).</summary>
    public string Domain { get; set; } = string.Empty;

    /// <summary>Tenant id (Guid) of the B2C tenant.</summary>
    public string TenantId { get; set; } = string.Empty;

    /// <summary>Application (client) id of the API registration in the B2C tenant.</summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>
    /// Primary user-flow / custom-policy name (e.g. <c>B2C_1_signupsignin</c>).
    /// The Api validates tokens issued by this policy by default; additional
    /// policies are accepted if listed in <see cref="AllowedPolicies"/>.
    /// </summary>
    public string SignUpSignInPolicyId { get; set; } = string.Empty;

    /// <summary>Extra policies whose tokens are accepted (e.g. <c>B2C_1_edit_profile</c>).</summary>
    public IReadOnlyList<string> AllowedPolicies { get; set; } = [];

    /// <summary>Audiences that B2C-issued tokens must be minted for.</summary>
    public IReadOnlyList<string> Audiences { get; set; } = [];
}
