using System.Globalization;
using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Domain.ValueObjects;

/// <summary>
/// 0–100 decimal percentage. Arithmetic clamps to the valid range — callers that
/// want wrap-around semantics should model a distinct type. Comparison + equality
/// operate on the stored <see cref="Value"/>.
/// </summary>
public sealed class Percentage : ValueObject
{
    /// <summary>Lower bound (inclusive).</summary>
    public const decimal Min = 0m;

    /// <summary>Upper bound (inclusive).</summary>
    public const decimal Max = 100m;

    private Percentage(decimal value) => Value = value;

    /// <summary>Percentage value in the range <c>[0, 100]</c>.</summary>
    public decimal Value { get; }

    /// <summary>Fractional representation (<c>Value / 100</c>) — useful for multiplying.</summary>
    public decimal Fraction => Value / 100m;

    /// <summary>Zero.</summary>
    public static Percentage Zero { get; } = new(Min);

    /// <summary>One hundred percent.</summary>
    public static Percentage Full { get; } = new(Max);

    /// <summary>Builds a percentage from a decimal in the range <c>[0, 100]</c>.</summary>
    public static Result<Percentage> Create(decimal value)
    {
        if (value < Min || value > Max)
        {
            return Error.Validation($"Percentage must be in [{Min}, {Max}]; got {value}.");
        }

        return new Percentage(value);
    }

    /// <summary>Adds two percentages. Result clamps to <c>[0, 100]</c>.</summary>
    public Percentage Add(Percentage other)
    {
        ArgumentNullException.ThrowIfNull(other);
        return new Percentage(Math.Clamp(Value + other.Value, Min, Max));
    }

    /// <summary>Subtracts <paramref name="other"/> from this. Result clamps to <c>[0, 100]</c>.</summary>
    public Percentage Subtract(Percentage other)
    {
        ArgumentNullException.ThrowIfNull(other);
        return new Percentage(Math.Clamp(Value - other.Value, Min, Max));
    }

    /// <summary>Applies the percentage to <paramref name="amount"/> — i.e. <c>amount * Fraction</c>.</summary>
    public decimal Of(decimal amount) => Math.Round(amount * Fraction, 6, MidpointRounding.ToEven);

    /// <inheritdoc />
    public override string ToString()
        => string.Create(CultureInfo.InvariantCulture, $"{Value:0.##}%");

    /// <inheritdoc />
    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }
}
