namespace Enterprise.Platform.Application.Abstractions.Behaviors;

/// <summary>
/// Opt-in marker for commands that must evict cache entries on success.
/// <c>CacheInvalidationBehavior</c> reads <see cref="CacheKeysToInvalidate"/> after
/// the handler completes (and the outer transaction commits) and calls
/// <c>IDistributedCache.RemoveAsync</c> for each key. Eviction runs <b>only</b> on
/// a successful response — failed handlers leave cache untouched.
/// </summary>
/// <remarks>
/// For list-style invalidation (e.g. "evict all <c>roles:list:*</c>"), either:
/// <list type="bullet">
///   <item>Enumerate known list keys explicitly (works for small, fixed filter sets).</item>
///   <item>Use a "version key" pattern: list cache keys include a version segment,
///         eviction bumps the version, all existing entries become unreachable
///         without needing to enumerate them. This is the Redis-native idiom.</item>
///   <item>Accept TTL-based staleness for lists (good default when churn is low).</item>
/// </list>
/// The interface is the same; the strategy is per-aggregate.
/// </remarks>
public interface ICacheInvalidating
{
    /// <summary>
    /// Keys to remove after the handler completes. Keys should match the exact form
    /// written by <see cref="ICacheable.CacheKey"/> on read-side queries (including
    /// the tenant/user qualifier). The cache layer prepends its configured prefix
    /// separately.
    /// </summary>
    IEnumerable<string> CacheKeysToInvalidate();
}
