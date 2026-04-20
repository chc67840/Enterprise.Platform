using System.Collections.Concurrent;
using Azure.Security.KeyVault.Secrets;
using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Infrastructure.Configuration;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Infrastructure.Security.DataEncryption;

/// <summary>
/// Azure Key Vault-backed <see cref="IKeyManagementService"/>. Symmetric keys are
/// stored as Key Vault <b>secrets</b> (Base64-encoded raw bytes) — not as Key Vault
/// <b>keys</b> — because AES-GCM needs the material in-process for
/// <see cref="EncryptedStringConverter"/>. Cached per-process after first retrieval;
/// eviction relies on pod restart or an explicit <see cref="InvalidateCache"/> call.
/// </summary>
/// <remarks>
/// <para>
/// Secret naming convention: <c>ep-keys-{keyName}</c>. Each secret value is the
/// Base64 encoding of a 32-byte random key. Rotate by versioning the secret in
/// Key Vault; the service uses the latest version by default.
/// </para>
/// <para>
/// Kept <b>off</b> the request path via the cache — Key Vault latency is ~50ms per
/// call which would dominate a typical <c>SaveChanges</c>.
/// </para>
/// </remarks>
public sealed class AzureKeyVaultKeyManagementService : IKeyManagementService
{
    private const string KeyNamePrefix = "ep-keys-";
    private readonly SecretClient _secretClient;
    private readonly ConcurrentDictionary<string, byte[]> _cache = new(StringComparer.Ordinal);

    /// <summary>Initializes using the configured vault URI + credential.</summary>
    public AzureKeyVaultKeyManagementService(IOptions<AzureSettings> options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var settings = options.Value;

        if (string.IsNullOrWhiteSpace(settings.KeyVaultUri))
        {
            throw new InvalidOperationException(
                "AzureKeyVaultKeyManagementService requires Azure.KeyVaultUri to be configured.");
        }

        var vaultUri = new Uri(settings.KeyVaultUri, UriKind.Absolute);
        _secretClient = new SecretClient(
            vaultUri,
            AzureKeyVaultConfigurationExtensions.BuildCredential(settings.ManagedIdentityClientId));
    }

    /// <inheritdoc />
    public async Task<byte[]> GetSymmetricKeyAsync(string keyName, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(keyName);

        if (_cache.TryGetValue(keyName, out var cached))
        {
            return cached;
        }

        var response = await _secretClient
            .GetSecretAsync($"{KeyNamePrefix}{keyName}", version: null, cancellationToken)
            .ConfigureAwait(false);

        var value = response.Value?.Value
            ?? throw new InvalidOperationException($"Key Vault secret '{KeyNamePrefix}{keyName}' has no value.");

        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(value);
        }
        catch (FormatException ex)
        {
            throw new InvalidOperationException(
                $"Key Vault secret '{KeyNamePrefix}{keyName}' is not valid Base64.", ex);
        }

        if (bytes.Length != 32)
        {
            throw new InvalidOperationException(
                $"Key Vault secret '{KeyNamePrefix}{keyName}' is {bytes.Length} bytes; expected 32 (256-bit AES key).");
        }

        _cache[keyName] = bytes;
        return bytes;
    }

    /// <summary>Clears the in-process cache — call after an external rotation to force re-fetch.</summary>
    public void InvalidateCache() => _cache.Clear();
}
