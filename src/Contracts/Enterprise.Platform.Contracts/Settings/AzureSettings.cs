namespace Enterprise.Platform.Contracts.Settings;

/// <summary>
/// Azure-specific endpoints. Kept in one POCO so host startup wires Key Vault, App
/// Configuration, and Blob Storage from a single binding. All values are URIs — never
/// bake credentials into them; use Managed Identity (preferred) or
/// <c>Azure.Identity.DefaultAzureCredential</c>.
/// </summary>
public sealed class AzureSettings
{
    /// <summary>Configuration section name — <c>Azure</c>.</summary>
    public const string SectionName = "Azure";

    /// <summary>
    /// Key Vault URI (e.g. <c>https://kv-ep-prod.vault.azure.net/</c>). Empty disables
    /// Key Vault secret resolution — useful for local dev against <c>user-secrets</c>.
    /// </summary>
    public string KeyVaultUri { get; set; } = string.Empty;

    /// <summary>
    /// Blob Storage account endpoint (e.g. <c>https://stepprod.blob.core.windows.net/</c>).
    /// Empty falls back to <c>LocalFileStorageService</c> (dev-only, marked commented in
    /// Infrastructure).
    /// </summary>
    public string BlobAccount { get; set; } = string.Empty;

    /// <summary>
    /// App Configuration endpoint (e.g. <c>https://appcs-ep-prod.azconfig.io</c>). When
    /// set, host startup layers App Configuration on top of <c>appsettings.json</c>.
    /// </summary>
    public string AppConfigEndpoint { get; set; } = string.Empty;

    /// <summary>
    /// Optional Managed Identity client id. Leave empty to use the system-assigned
    /// identity; populate only when multiple user-assigned identities are bound to the
    /// host.
    /// </summary>
    public string? ManagedIdentityClientId { get; set; }
}
