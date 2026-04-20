using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Domain.ValueObjects;

/// <summary>
/// ISO 4217 currency — static catalogue of supported currencies so consumers bind
/// to a stable reference rather than free-form strings. Additional currencies are
/// added as <c>public static readonly Currency</c> fields + the lookup rebuilds on
/// first access.
/// </summary>
public sealed class Currency : ValueObject
{
    /// <summary>United States dollar.</summary>
    public static readonly Currency Usd = new("USD", "US Dollar", 2);

    /// <summary>Euro.</summary>
    public static readonly Currency Eur = new("EUR", "Euro", 2);

    /// <summary>Pound sterling.</summary>
    public static readonly Currency Gbp = new("GBP", "Pound Sterling", 2);

    /// <summary>Indian rupee.</summary>
    public static readonly Currency Inr = new("INR", "Indian Rupee", 2);

    /// <summary>Japanese yen — zero-decimal currency.</summary>
    public static readonly Currency Jpy = new("JPY", "Japanese Yen", 0);

    /// <summary>Swiss franc.</summary>
    public static readonly Currency Chf = new("CHF", "Swiss Franc", 2);

    /// <summary>Canadian dollar.</summary>
    public static readonly Currency Cad = new("CAD", "Canadian Dollar", 2);

    /// <summary>Australian dollar.</summary>
    public static readonly Currency Aud = new("AUD", "Australian Dollar", 2);

    private static readonly Lazy<IReadOnlyDictionary<string, Currency>> ByCode = new(BuildCatalogue);

    private Currency(string code, string displayName, int decimalDigits)
    {
        Code = code;
        DisplayName = displayName;
        DecimalDigits = decimalDigits;
    }

    /// <summary>ISO 4217 three-letter code (upper-case).</summary>
    public string Code { get; }

    /// <summary>Human-readable name.</summary>
    public string DisplayName { get; }

    /// <summary>Default scale for arithmetic / display (0 for JPY, 2 for most, 3 for BHD/KWD).</summary>
    public int DecimalDigits { get; }

    /// <summary>All currencies currently catalogued.</summary>
    public static IEnumerable<Currency> All => ByCode.Value.Values;

    /// <summary>Resolves a currency by its ISO code (case-insensitive).</summary>
    public static Result<Currency> FromCode(string? code)
    {
        if (string.IsNullOrWhiteSpace(code) || code.Length != 3)
        {
            return Error.Validation("Currency code must be a 3-letter ISO 4217 code.");
        }

        return ByCode.Value.TryGetValue(code.ToUpperInvariant(), out var currency)
            ? currency
            : Error.Validation($"Currency '{code.ToUpperInvariant()}' is not supported by the platform catalogue.");
    }

    /// <inheritdoc />
    public override string ToString() => Code;

    /// <inheritdoc />
    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Code;
    }

    private static Dictionary<string, Currency> BuildCatalogue()
        => new[] { Usd, Eur, Gbp, Inr, Jpy, Chf, Cad, Aud }
            .ToDictionary(c => c.Code, StringComparer.Ordinal);
}
