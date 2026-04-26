namespace Enterprise.Platform.Application.Abstractions.Behaviors;

/// <summary>
/// P2-2 (audit) — region-prefix eviction abstraction. Concrete implementations
/// live in Infrastructure (one per cache provider). Application layer depends
/// only on this contract so handlers + behaviors stay infrastructure-agnostic.
/// </summary>
public interface ICacheRegionInvalidator
{
    /// <summary>
    /// Removes every cache entry under the supplied region prefix. Implementations
    /// MUST be idempotent and tolerate empty regions (no entries match → no-op).
    /// </summary>
    /// <param name="region">Region prefix (e.g. <c>"roles"</c>); the cache layer
    /// prepends its configured global prefix.</param>
    Task InvalidateRegionAsync(string region, CancellationToken cancellationToken = default);
}
