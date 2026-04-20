using System.Security.Cryptography;
using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Infrastructure.Security.DataEncryption;

/// <summary>
/// Central access point for cryptographic keys used by the platform. In development
/// it derives a deterministic 256-bit key from the machine + environment (so dev
/// databases stay decryptable across restarts). In production this is replaced by
/// an Azure Key Vault-backed implementation — <see cref="AzureSettings.KeyVaultUri"/>
/// supplies the vault; Managed Identity provides the auth.
/// </summary>
public interface IKeyManagementService
{
    /// <summary>Returns the symmetric key registered under <paramref name="keyName"/>.</summary>
    Task<byte[]> GetSymmetricKeyAsync(string keyName, CancellationToken cancellationToken = default);
}

/// <summary>
/// Development-only <see cref="IKeyManagementService"/>. Derives a deterministic key
/// from a configured master secret — good enough to keep column-encryption tests
/// reproducible, <b>never acceptable for production</b>. Production hosts swap for an
/// Azure Key Vault backed implementation.
/// </summary>
public sealed class DevKeyManagementService(IOptionsMonitor<AzureSettings> options) : IKeyManagementService
{
    private readonly IOptionsMonitor<AzureSettings> _options = options
        ?? throw new ArgumentNullException(nameof(options));

    /// <inheritdoc />
    public Task<byte[]> GetSymmetricKeyAsync(string keyName, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(keyName);

        // Derive a stable 256-bit key from the Key Vault URI (placeholder seed) + the
        // key name. HKDF keeps the derivation cryptographically sound without storing
        // keys at rest in dev.
        var seed = _options.CurrentValue.KeyVaultUri ?? "dev-ep-seed";
        var derived = HKDF.DeriveKey(
            HashAlgorithmName.SHA256,
            System.Text.Encoding.UTF8.GetBytes(seed),
            outputLength: 32,
            salt: System.Text.Encoding.UTF8.GetBytes("enterprise-platform"),
            info: System.Text.Encoding.UTF8.GetBytes(keyName));
        return Task.FromResult(derived);
    }
}
