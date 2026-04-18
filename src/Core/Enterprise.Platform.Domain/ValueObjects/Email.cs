using System.Text.RegularExpressions;
using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Domain.ValueObjects;

/// <summary>
/// Canonicalised email address. Always normalised to lower-case on creation so
/// equality and database look-ups are case-insensitive without relying on the
/// collation of the host column.
/// </summary>
public sealed partial class Email : ValueObject
{
    // RFC 5322 is intentionally broad. Practical constraint: a single '@', at least
    // one character on either side, and a dot in the domain.
    [GeneratedRegex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 500)]
    private static partial Regex Pattern();

    private Email(string value) => Value = value;

    /// <summary>Normalised (lower-cased, trimmed) email string.</summary>
    public string Value { get; }

    /// <summary>
    /// Parses an email from raw user input. Returns a <see cref="Result{T}"/> rather
    /// than throwing so callers surface the failure through the handler pipeline.
    /// </summary>
    public static Result<Email> Create(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Error.Validation("Email cannot be empty.");
        }

        var normalized = raw.Trim().ToLowerInvariant();

        if (!Pattern().IsMatch(normalized))
        {
            return Error.Validation($"'{raw}' is not a valid email address.");
        }

        return new Email(normalized);
    }

    /// <summary>Returns the canonical string form.</summary>
    public override string ToString() => Value;

    /// <inheritdoc />
    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }
}
