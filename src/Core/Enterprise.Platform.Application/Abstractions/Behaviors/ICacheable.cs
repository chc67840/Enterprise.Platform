namespace Enterprise.Platform.Application.Abstractions.Behaviors;

/// <summary>
/// Opt-in marker for cacheable queries. <c>CachingBehavior</c> short-circuits the
/// handler when a value exists for <see cref="CacheKey"/>; otherwise it runs the
/// handler and stores the result with <see cref="Ttl"/>. Implementations must build
/// deterministic cache keys — same inputs → same key.
/// </summary>
public interface ICacheable
{
    /// <summary>
    /// Deterministic cache key. Include enough of the request's input that two distinct
    /// inputs never produce the same key (include tenant id for tenant-scoped data).
    /// </summary>
    string CacheKey { get; }

    /// <summary>
    /// TTL override. When <c>null</c>, the behavior uses the region TTL from
    /// <c>CacheSettings.Regions</c> or <c>CacheSettings.DefaultTtl</c>.
    /// </summary>
    TimeSpan? Ttl => null;

    /// <summary>
    /// Optional region tag used to look up a TTL in <c>CacheSettings.Regions</c>
    /// (e.g. <c>"users"</c>, <c>"lookups"</c>). <c>null</c> falls back to the default.
    /// </summary>
    string? CacheRegion => null;
}
