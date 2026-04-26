namespace Enterprise.Platform.Application.Abstractions.Behaviors;

/// <summary>
/// P2-2 (audit) — opt-in marker for commands that evict entire CACHE REGIONS
/// (not individual keys) on success. Complements <see cref="ICacheInvalidating"/>:
/// regions are correct when a mutation touches many cached entries with a shared
/// prefix; explicit keys are correct when only one or two entries are affected.
/// </summary>
/// <remarks>
/// <para>
/// <b>How regions map to keys.</b> Cached items declare a region via
/// <c>ICacheable.CacheRegion</c> (added alongside <c>CacheKey</c>). The cache
/// provider stores keys under <c>{prefix}:{region}:{key}</c> so region eviction
/// is a prefix-delete: <c>ep:roles:*</c> evicts every <c>roles:*</c> entry.
/// </para>
/// <para>
/// <b>When to use which.</b>
/// <list type="bullet">
///   <item><see cref="ICacheInvalidating"/> — single mutation affecting one or
///   two known cached items (e.g. "DeleteRole(id)" evicts the by-id read).</item>
///   <item><see cref="ICacheRegionInvalidating"/> — bulk mutations or list-shape
///   reads with many filter combinations (e.g. "RecalculateAllRolePermissions"
///   should wipe the entire <c>roles</c> region rather than enumerate every
///   filter combination that may be cached).</item>
/// </list>
/// A command can implement both interfaces.
/// </para>
/// <para>
/// <b>Provider behaviour.</b> Region eviction uses the
/// <c>ICacheRegionInvalidator</c> service in Infrastructure. The default
/// implementation works for Redis (SCAN+DEL); the in-memory provider degrades
/// to a no-op + warning log because <c>MemoryDistributedCache</c> doesn't
/// expose prefix queries. For dev/test that's acceptable — production
/// deployments use Redis.
/// </para>
/// </remarks>
public interface ICacheRegionInvalidating
{
    /// <summary>
    /// Region prefixes to wipe after the handler completes successfully. Each
    /// region maps to a key prefix; the cache layer prepends its configured
    /// global prefix separately. Examples: <c>"roles"</c>, <c>"permissions"</c>,
    /// <c>"users"</c>.
    /// </summary>
    IEnumerable<string> CacheRegionsToInvalidate();
}
