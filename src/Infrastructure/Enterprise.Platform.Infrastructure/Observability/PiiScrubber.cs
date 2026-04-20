using System.Text.RegularExpressions;

namespace Enterprise.Platform.Infrastructure.Observability;

/// <summary>
/// Helper functions that redact common PII patterns before logs / audit records ship
/// to downstream systems. Intentionally conservative: false positives (over-masking
/// a legitimate string) are preferable to false negatives (leaking a credential).
/// </summary>
public static partial class PiiScrubber
{
    private const string Redacted = "[REDACTED]";

    [GeneratedRegex("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 500)]
    private static partial Regex EmailPattern();

    [GeneratedRegex("\\+?\\d[\\d\\s().-]{7,}\\d", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 500)]
    private static partial Regex PhonePattern();

    [GeneratedRegex("\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\\b", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 500)]
    private static partial Regex CreditCardPattern();

    /// <summary>Masks emails, phone numbers, and credit cards in <paramref name="input"/>.</summary>
    public static string Scrub(string? input)
    {
        if (string.IsNullOrEmpty(input))
        {
            return input ?? string.Empty;
        }

        var sanitized = EmailPattern().Replace(input, Redacted);
        sanitized = CreditCardPattern().Replace(sanitized, Redacted);
        sanitized = PhonePattern().Replace(sanitized, Redacted);
        return sanitized;
    }
}
