using System.Text.RegularExpressions;
using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Domain.ValueObjects;

/// <summary>
/// E.164-normalised phone number (e.g. <c>+14155551234</c>). All digits; a leading
/// <c>+</c> and country code are mandatory. We intentionally don't do country-aware
/// length validation here — that belongs in an infrastructure validator that can
/// consult a library like <c>libphonenumber</c>.
/// </summary>
public sealed partial class PhoneNumber : ValueObject
{
    [GeneratedRegex("^\\+[1-9][0-9]{7,14}$", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 500)]
    private static partial Regex E164();

    private PhoneNumber(string value) => Value = value;

    /// <summary>E.164-formatted phone string.</summary>
    public string Value { get; }

    /// <summary>Parses a phone number; strips whitespace, hyphens, and parentheses before validating.</summary>
    public static Result<PhoneNumber> Create(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Error.Validation("Phone number cannot be empty.");
        }

        var stripped = new string([.. raw.Where(ch => ch == '+' || char.IsDigit(ch))]);

        if (!E164().IsMatch(stripped))
        {
            return Error.Validation($"'{raw}' is not a valid E.164 phone number.");
        }

        return new PhoneNumber(stripped);
    }

    /// <inheritdoc />
    public override string ToString() => Value;

    /// <inheritdoc />
    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }
}
