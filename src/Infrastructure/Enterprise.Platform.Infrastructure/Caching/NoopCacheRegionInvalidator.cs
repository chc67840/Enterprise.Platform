using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Infrastructure.Common;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Infrastructure.Caching;

/// <summary>
/// P2-2 (audit) — default <see cref="ICacheRegionInvalidator"/> for cache providers
/// that don't expose a prefix-scan API (in-memory <c>MemoryDistributedCache</c>
/// being the prime example). Logs the region eviction request at Information so
/// developers can confirm the invalidation pipeline fired even when the provider
/// can't physically evict — entries fall out by TTL instead.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why this is acceptable for in-memory.</b> The in-memory cache is dev-only;
/// region eviction works correctly via the SCAN+DEL Redis implementation in
/// production. Until Redis is wired, in-memory tests and dev runs see stale
/// reads up to <c>CacheSettings.DefaultTtl</c> after a region invalidation —
/// loud-but-not-broken behaviour.
/// </para>
/// <para>
/// <b>To replace.</b> When Redis goes live, register a
/// <c>RedisCacheRegionInvalidator</c> that issues <c>SCAN MATCH {prefix}:{region}:*</c>
/// followed by <c>DEL</c> on the matched keys (use the <c>StackExchange.Redis</c>
/// IServer.Keys with a server endpoint to avoid blocking SCAN behaviour). Wire
/// it via the same DI swap the cache provider uses today.
/// </para>
/// </remarks>
public sealed class NoopCacheRegionInvalidator(
    ILogger<NoopCacheRegionInvalidator> logger) : ICacheRegionInvalidator
{
    private readonly ILogger<NoopCacheRegionInvalidator> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <inheritdoc />
    public Task InvalidateRegionAsync(string region, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(region);
        _logger.CacheRegionInvalidationDeferred(region);
        return Task.CompletedTask;
    }
}
