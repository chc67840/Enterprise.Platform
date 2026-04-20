using System.Text.RegularExpressions;
using System.Web;

namespace Enterprise.Platform.Infrastructure.Security;

/// <summary>
/// Defensive helpers for sanitizing untrusted user input. <b>This is not a WAF</b> —
/// primary protection is always parameterised queries (EF Core, Dapper) + CSP headers
/// on the response. Use these helpers as belt-and-braces when rendering user-supplied
/// text in log messages, identifiers, or HTML-like contexts.
/// </summary>
public static partial class InputSanitizer
{
    [GeneratedRegex("[\\r\\n\\t\\x00-\\x1F\\x7F]", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 500)]
    private static partial Regex ControlCharsPattern();

    [GeneratedRegex("[^A-Za-z0-9_.-]+", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 500)]
    private static partial Regex NonIdentifierPattern();

    /// <summary>Escapes <paramref name="input"/> for safe inclusion in HTML content.</summary>
    public static string EscapeHtml(string? input)
        => string.IsNullOrEmpty(input) ? string.Empty : HttpUtility.HtmlEncode(input);

    /// <summary>Removes control characters (CR/LF/TAB/NUL/etc.) from a log-bound string.</summary>
    public static string StripControlCharacters(string? input)
        => string.IsNullOrEmpty(input) ? string.Empty : ControlCharsPattern().Replace(input, string.Empty);

    /// <summary>Reduces <paramref name="input"/> to an ASCII identifier-safe subset (letters, digits, <c>_ . -</c>).</summary>
    public static string ToSafeIdentifier(string? input)
        => string.IsNullOrEmpty(input) ? string.Empty : NonIdentifierPattern().Replace(input, string.Empty);
}
