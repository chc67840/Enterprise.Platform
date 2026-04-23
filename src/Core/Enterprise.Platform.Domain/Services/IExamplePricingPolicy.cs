namespace Enterprise.Platform.Domain.Services;

/// <summary>
/// <b>Canonical Domain Service template.</b> Delete or replace once the first
/// real Domain Service ships — this exists to demonstrate the pattern for
/// new contributors. See <c>README.md</c> in this folder for the full
/// "when to put a class here" guidance.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why this is a Domain Service (not an Application or Infrastructure Service).</b>
/// </para>
/// <list type="bullet">
///   <item>It's a pure business rule (computing a price given quantity and tier).</item>
///   <item>It doesn't fit cleanly inside a single aggregate (the rule references
///         a price-tier table that's its own aggregate).</item>
///   <item>It has zero infrastructure dependencies — no EF Core, no HttpClient,
///         no logger.</item>
///   <item>It's stateless — registered as a singleton.</item>
/// </list>
/// <para>
/// Application handlers call this from inside their orchestration logic;
/// the handler reaches for the price tier via <c>IPriceTierRepository</c>,
/// then asks this service to compute the effective price.
/// </para>
/// </remarks>
public interface IExamplePricingPolicy
{
    /// <summary>
    /// Computes the effective unit price for a given quantity, taking
    /// volume-discount tiers into account.
    /// </summary>
    /// <param name="basePrice">The base unit price before volume adjustments. Must be non-negative.</param>
    /// <param name="quantity">The quantity being priced. Must be positive.</param>
    /// <param name="tier">The volume-discount tier applicable at this moment in time.</param>
    /// <returns>The effective per-unit price after applying the tier's discount.</returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// Thrown when <paramref name="basePrice"/> is negative or
    /// <paramref name="quantity"/> is non-positive.
    /// </exception>
    decimal ComputeEffectiveUnitPrice(decimal basePrice, int quantity, ExampleVolumeTier tier);
}

/// <summary>
/// Reference implementation. Replace with the real pricing rules when this
/// example is removed. Sealed because Domain Services should be final unless
/// inheritance is genuinely needed (it almost never is).
/// </summary>
public sealed class ExamplePricingPolicy : IExamplePricingPolicy
{
    /// <inheritdoc />
    public decimal ComputeEffectiveUnitPrice(decimal basePrice, int quantity, ExampleVolumeTier tier)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(basePrice);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(quantity);
        ArgumentNullException.ThrowIfNull(tier);

        // Trivial example logic — real policies would consult a tiered
        // discount table, jurisdiction-specific rules, etc.
        var discounted = basePrice * (1m - tier.DiscountPercent / 100m);
        return Math.Round(discounted, 2, MidpointRounding.ToEven);
    }
}

/// <summary>
/// Value object representing a volume-discount tier. Lives here for the
/// example only; real tiers would live in <c>Domain/Aggregates/</c> or
/// <c>Domain/ValueObjects/</c>.
/// </summary>
public sealed record ExampleVolumeTier(int MinimumQuantity, decimal DiscountPercent);
