using Enterprise.Platform.Infrastructure.Common;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Infrastructure.Caching;

/// <summary>
/// Fan-out helper for cache invalidation. Wraps the raw <see cref="IDistributedCache"/>
/// with logging + batched removes so command handlers can invalidate affected keys
/// after a successful <c>SaveChanges</c>.
/// </summary>
/// <remarks>
/// Prefix-wipe semantics depend on the backing provider: in-memory
/// <c>MemoryDistributedCache</c> doesn't expose prefix queries, so this service only
/// supports explicit key removes. Redis (when wired) can add a <c>SCAN + DEL</c>
/// companion method.
/// </remarks>
public sealed class CacheInvalidationService(
    IDistributedCache cache,
    ILogger<CacheInvalidationService> logger)
{
    private readonly IDistributedCache _cache = cache ?? throw new ArgumentNullException(nameof(cache));
    private readonly ILogger<CacheInvalidationService> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <summary>Removes a single key.</summary>
    public async Task InvalidateAsync(string key, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        await _cache.RemoveAsync(key, cancellationToken).ConfigureAwait(false);
        _logger.CacheInvalidated(key);
    }

    /// <summary>Removes a batch of keys in parallel.</summary>
    public async Task InvalidateAsync(IEnumerable<string> keys, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(keys);
        var batch = keys.Where(k => !string.IsNullOrWhiteSpace(k)).ToArray();
        if (batch.Length == 0)
        {
            return;
        }

        await Task.WhenAll(batch.Select(k => _cache.RemoveAsync(k, cancellationToken))).ConfigureAwait(false);
        if (_logger.IsEnabled(LogLevel.Debug))
        {
            _logger.CacheInvalidated(string.Join(", ", batch));
        }
    }
}
