using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Enterprise.Platform.Application.Common.Extensions;

/// <summary>
/// Application-layer string helpers — these need types not available in
/// <c>Enterprise.Platform.Shared</c> (cryptography, culture-aware transforms) so
/// they live here instead of on the leaf project.
/// </summary>
public static class StringExtensions
{
    /// <summary>
    /// Returns a deterministic SHA-256 hash, hex-encoded lower-case. Used to build cache
    /// keys and idempotency keys from variable-length inputs without risking collisions.
    /// </summary>
    public static string ToSha256Hex(this string value)
    {
        ArgumentNullException.ThrowIfNull(value);
        var bytes = Encoding.UTF8.GetBytes(value);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexStringLower(hash);
    }

    /// <summary>
    /// Culture-invariant <c>ToTitleCase</c>. Unlike <c>CultureInfo.CurrentCulture.TextInfo</c>
    /// this uses the invariant culture so output is stable across environments.
    /// </summary>
    public static string ToInvariantTitleCase(this string value)
    {
        ArgumentNullException.ThrowIfNull(value);
        return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(value.ToLowerInvariant());
    }
}
