using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Application.Behaviors;

/// <summary>
/// Pipeline order 8 — outermost after the transaction boundary. Evicts cache
/// entries listed by <see cref="ICacheInvalidating.CacheKeysToInvalidate"/> AND
/// region prefixes listed by <see cref="ICacheRegionInvalidating.CacheRegionsToInvalidate"/>
/// <b>only when the handler returns successfully</b>. Registered after
/// <c>TransactionBehavior</c> so a rolled-back transaction doesn't evict
/// otherwise-valid cache entries.
/// </summary>
/// <remarks>
/// <b>P2-2 audit:</b> commands can declare invalidation scope via either or both
/// interfaces. Per-key removes (<see cref="ICacheInvalidating"/>) are exact +
/// portable across cache providers. Region prefixes
/// (<see cref="ICacheRegionInvalidating"/>) require a provider that supports
/// prefix scans (Redis); see <see cref="ICacheRegionInvalidator"/>.
/// </remarks>
public sealed class CacheInvalidationBehavior<TRequest, TResponse>(
    IDistributedCache cache,
    IOptions<CacheSettings> cacheSettings,
    ICacheRegionInvalidator regionInvalidator,
    ILogger<CacheInvalidationBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IDistributedCache _cache = cache ?? throw new ArgumentNullException(nameof(cache));
    private readonly CacheSettings _settings = cacheSettings?.Value ?? throw new ArgumentNullException(nameof(cacheSettings));
    private readonly ICacheRegionInvalidator _regionInvalidator = regionInvalidator ?? throw new ArgumentNullException(nameof(regionInvalidator));
    private readonly ILogger<CacheInvalidationBehavior<TRequest, TResponse>> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <inheritdoc />
    public async Task<TResponse> HandleAsync(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(next);

        var response = await next().ConfigureAwait(false);

        // Per-key invalidation — exact, portable, fast.
        if (request is ICacheInvalidating invalidating)
        {
            await EvictKeysAsync(invalidating.CacheKeysToInvalidate(), cancellationToken).ConfigureAwait(false);
        }

        // Region invalidation — provider-dependent (Redis SCAN, in-memory no-op).
        if (request is ICacheRegionInvalidating regionInvalidating)
        {
            await EvictRegionsAsync(regionInvalidating.CacheRegionsToInvalidate(), cancellationToken).ConfigureAwait(false);
        }

        return response;
    }

    private async Task EvictKeysAsync(IEnumerable<string> keys, CancellationToken cancellationToken)
    {
        foreach (var key in keys)
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            var storeKey = $"{_settings.KeyPrefix}:{key}";
            try
            {
                await _cache.RemoveAsync(storeKey, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Failures to evict shouldn't bubble — worst case the read is stale until TTL.
                _logger.CacheInvalidationFailed(ex, storeKey);
            }
        }
    }

    private async Task EvictRegionsAsync(IEnumerable<string> regions, CancellationToken cancellationToken)
    {
        foreach (var region in regions)
        {
            if (string.IsNullOrWhiteSpace(region))
            {
                continue;
            }

            try
            {
                await _regionInvalidator.InvalidateRegionAsync(region, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.CacheRegionInvalidationFailed(ex, region);
            }
        }
    }
}
