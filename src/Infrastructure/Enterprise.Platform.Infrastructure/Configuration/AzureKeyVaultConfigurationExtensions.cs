using Azure.Extensions.AspNetCore.Configuration.Secrets;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.Configuration;

namespace Enterprise.Platform.Infrastructure.Configuration;

/// <summary>
/// Wires Azure Key Vault as a configuration source so <c>IConfiguration</c> resolves
/// secret-keyed values transparently. Added <b>last</b> in the configuration pipeline
/// (so Key Vault wins over appsettings + env vars) when
/// <see cref="AzureSettings.KeyVaultUri"/> is populated; otherwise no-op.
/// </summary>
/// <remarks>
/// <para>
/// Authentication uses <see cref="DefaultAzureCredential"/> with a resolved
/// <see cref="AzureSettings.ManagedIdentityClientId"/> when set — supports the full
/// credential chain (Managed Identity in Azure, Azure CLI / Visual Studio / env vars
/// in dev).
/// </para>
/// <para>
/// Secret names in Key Vault use the Microsoft convention <c>--</c> as the section
/// separator (e.g. <c>Jwt--SigningKey</c> → <c>Jwt:SigningKey</c>). The built-in
/// manager reshapes them automatically.
/// </para>
/// </remarks>
public static class AzureKeyVaultConfigurationExtensions
{
    /// <summary>Adds Key Vault as a configuration source when configured; no-op otherwise.</summary>
    public static IConfigurationBuilder AddPlatformKeyVaultIfConfigured(this IConfigurationBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        // Build a throwaway root to read the Azure section with the sources registered so far.
        var preliminary = builder.Build();
        var settings = preliminary.GetSection(AzureSettings.SectionName).Get<AzureSettings>() ?? new AzureSettings();

        if (string.IsNullOrWhiteSpace(settings.KeyVaultUri))
        {
            return builder;
        }

        if (!Uri.TryCreate(settings.KeyVaultUri, UriKind.Absolute, out var vaultUri))
        {
            throw new InvalidOperationException(
                $"Azure.KeyVaultUri='{settings.KeyVaultUri}' is not a valid absolute URI.");
        }

        var credential = BuildCredential(settings.ManagedIdentityClientId);
        var secretClient = new SecretClient(vaultUri, credential);

        builder.AddAzureKeyVault(secretClient, new KeyVaultSecretManager());
        return builder;
    }

    internal static DefaultAzureCredential BuildCredential(string? managedIdentityClientId)
        => string.IsNullOrWhiteSpace(managedIdentityClientId)
            ? new DefaultAzureCredential()
            : new DefaultAzureCredential(new DefaultAzureCredentialOptions
            {
                ManagedIdentityClientId = managedIdentityClientId,
            });
}
