using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Enterprise.Platform.Infrastructure.Security.DataEncryption;

/// <summary>
/// EF Core <see cref="ValueConverter{TModel, TProvider}"/> that encrypts a
/// <see cref="string"/> property at rest using AES-GCM. Columns decorated with
/// <c>.HasConversion(new EncryptedStringConverter(key))</c> store the ciphertext +
/// nonce + tag as a single Base64 string.
/// </summary>
/// <remarks>
/// <para>
/// Format: <c>"v1" + Base64(nonce || ciphertext || tag)</c>. The <c>"v1"</c> prefix
/// lets us rotate formats without ambiguity in a future migration.
/// </para>
/// <para>
/// The 32-byte key is supplied at converter construction — typically resolved from
/// <see cref="KeyManagementService"/> at DbContext configuration time. <b>Never</b>
/// cache the raw key in a static field, and never write plaintext to logs.
/// </para>
/// </remarks>
public sealed class EncryptedStringConverter : ValueConverter<string, string>
{
    private const string Version = "v1";
    private const int NonceSize = 12;   // AES-GCM recommended nonce size
    private const int TagSize = 16;     // AES-GCM tag size

    /// <summary>Initialises the converter with a 256-bit key.</summary>
    public EncryptedStringConverter(byte[] key)
        : base(
            plaintext => Encrypt(plaintext, key),
            ciphertext => Decrypt(ciphertext, key))
    {
        ArgumentNullException.ThrowIfNull(key);
        if (key.Length != 32)
        {
            throw new ArgumentException("EncryptedStringConverter requires a 256-bit (32-byte) key.", nameof(key));
        }
    }

    private static string Encrypt(string plaintext, byte[] key)
    {
        if (string.IsNullOrEmpty(plaintext))
        {
            return plaintext;
        }

        var nonce = new byte[NonceSize];
        RandomNumberGenerator.Fill(nonce);

        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var ciphertext = new byte[plaintextBytes.Length];
        var tag = new byte[TagSize];

        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(nonce, plaintextBytes, ciphertext, tag);

        var combined = new byte[nonce.Length + ciphertext.Length + tag.Length];
        Buffer.BlockCopy(nonce, 0, combined, 0, nonce.Length);
        Buffer.BlockCopy(ciphertext, 0, combined, nonce.Length, ciphertext.Length);
        Buffer.BlockCopy(tag, 0, combined, nonce.Length + ciphertext.Length, tag.Length);
        return Version + Convert.ToBase64String(combined);
    }

    private static string Decrypt(string value, byte[] key)
    {
        if (string.IsNullOrEmpty(value))
        {
            return value;
        }

        if (!value.StartsWith(Version, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "EncryptedStringConverter: column value does not start with the expected version tag.");
        }

        var combined = Convert.FromBase64String(value[Version.Length..]);
        if (combined.Length < NonceSize + TagSize)
        {
            throw new InvalidOperationException("EncryptedStringConverter: payload is too short to contain nonce + tag.");
        }

        var nonce = new byte[NonceSize];
        var tag = new byte[TagSize];
        var ciphertext = new byte[combined.Length - NonceSize - TagSize];

        Buffer.BlockCopy(combined, 0, nonce, 0, NonceSize);
        Buffer.BlockCopy(combined, NonceSize, ciphertext, 0, ciphertext.Length);
        Buffer.BlockCopy(combined, NonceSize + ciphertext.Length, tag, 0, TagSize);

        using var aes = new AesGcm(key, TagSize);
        var plaintext = new byte[ciphertext.Length];
        aes.Decrypt(nonce, ciphertext, tag, plaintext);
        return Encoding.UTF8.GetString(plaintext);
    }
}
