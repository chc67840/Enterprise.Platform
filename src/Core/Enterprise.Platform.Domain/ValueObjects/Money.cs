using System.Globalization;
using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Domain.ValueObjects;

/// <summary>
/// Currency-aware monetary amount. Arithmetic is only permitted between values with
/// the same <see cref="Currency"/> — mixing throws, because mid-calculation currency
/// conversion is a policy decision that belongs in a dedicated service.
/// </summary>
public sealed class Money : ValueObject
{
    private Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    /// <summary>Numeric amount. Negative values are allowed (e.g. refunds).</summary>
    public decimal Amount { get; }

    /// <summary>ISO 4217 currency code (upper-case, three characters).</summary>
    public string Currency { get; }

    /// <summary>
    /// Builds a <see cref="Money"/> from an amount and ISO 4217 code. Returns a
    /// <see cref="Result{T}"/> — invalid currencies surface as validation errors
    /// without throwing.
    /// </summary>
    public static Result<Money> Create(decimal amount, string? currency)
    {
        if (string.IsNullOrWhiteSpace(currency) || currency.Length != 3)
        {
            return Error.Validation("Currency must be a 3-letter ISO 4217 code.");
        }

        return new Money(amount, currency.ToUpperInvariant());
    }

    /// <summary>Additively combines two amounts in the same currency.</summary>
    public Money Add(Money other)
    {
        ArgumentNullException.ThrowIfNull(other);
        EnsureSameCurrency(other);
        return new Money(Amount + other.Amount, Currency);
    }

    /// <summary>Subtracts <paramref name="other"/> from this amount.</summary>
    public Money Subtract(Money other)
    {
        ArgumentNullException.ThrowIfNull(other);
        EnsureSameCurrency(other);
        return new Money(Amount - other.Amount, Currency);
    }

    /// <summary>Scales the amount by a unit-less factor — currency is preserved.</summary>
    public Money Multiply(decimal factor) => new(Amount * factor, Currency);

    private void EnsureSameCurrency(Money other)
    {
        if (!string.Equals(Currency, other.Currency, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                $"Cannot operate on mismatched currencies ({Currency} vs {other.Currency}).");
        }
    }

    /// <inheritdoc />
    public override string ToString()
        => string.Create(CultureInfo.InvariantCulture, $"{Amount:0.00####} {Currency}");

    /// <inheritdoc />
    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Amount;
        yield return Currency;
    }
}
