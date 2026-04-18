using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Enterprise.Platform.Shared.Extensions;

/// <summary>
/// Cross-cutting string helpers. Keep pure — no I/O, no allocations beyond what the
/// method promises. Lives in <c>Shared</c> so Domain, Application, and UI can all use it
/// without taking a dependency on each other.
/// </summary>
public static class StringExtensions
{
    private static readonly Regex SlugInvalidChars = new("[^a-z0-9\\s-]", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex SlugWhitespace = new("\\s+", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex SlugHyphens = new("-+", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    /// <summary>
    /// Truncates <paramref name="value"/> to at most <paramref name="maxLength"/> characters.
    /// Returns the original string if it is already shorter, <c>null</c> when the input is
    /// <c>null</c>, and appends <paramref name="ellipsis"/> (default <c>…</c>) when truncation
    /// occurs and the caller opts in.
    /// </summary>
    public static string? Truncate(this string? value, int maxLength, string? ellipsis = null)
    {
        if (value is null)
        {
            return null;
        }

        ArgumentOutOfRangeException.ThrowIfNegative(maxLength);

        if (value.Length <= maxLength)
        {
            return value;
        }

        if (string.IsNullOrEmpty(ellipsis))
        {
            return value[..maxLength];
        }

        var keep = Math.Max(0, maxLength - ellipsis.Length);
        return string.Concat(value.AsSpan(0, keep), ellipsis);
    }

    /// <summary>
    /// Lowercases, strips diacritics, replaces non-alphanumerics with hyphens, and collapses
    /// repeated hyphens. Safe for URLs, file names, and deterministic keys. Returns
    /// <see cref="string.Empty"/> when the input is null/whitespace.
    /// </summary>
    public static string ToSlug(this string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalized = value.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(capacity: normalized.Length);

        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
            {
                sb.Append(ch);
            }
        }

        var stripped = sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
        stripped = SlugInvalidChars.Replace(stripped, string.Empty);
        stripped = SlugWhitespace.Replace(stripped, "-");
        stripped = SlugHyphens.Replace(stripped, "-");
        return stripped.Trim('-');
    }

    /// <summary>
    /// Masks the middle of a string, keeping <paramref name="visiblePrefix"/> leading and
    /// <paramref name="visibleSuffix"/> trailing characters. Useful for logging PII such as
    /// emails, phone numbers, and token fragments without exposing them in full.
    /// </summary>
    public static string? ToMask(this string? value, int visiblePrefix = 2, int visibleSuffix = 2, char maskChar = '*')
    {
        if (string.IsNullOrEmpty(value))
        {
            return value;
        }

        ArgumentOutOfRangeException.ThrowIfNegative(visiblePrefix);
        ArgumentOutOfRangeException.ThrowIfNegative(visibleSuffix);

        if (value.Length <= visiblePrefix + visibleSuffix)
        {
            return new string(maskChar, value.Length);
        }

        var masked = new string(maskChar, value.Length - visiblePrefix - visibleSuffix);
        return string.Concat(value.AsSpan(0, visiblePrefix), masked, value.AsSpan(value.Length - visibleSuffix));
    }
}
