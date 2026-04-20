using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Application.Behaviors;

/// <summary>
/// Pipeline order 8 — outermost after the transaction boundary. Evicts cache entries
/// listed by <see cref="ICacheInvalidating.CacheKeysToInvalidate"/> <b>only when the
/// handler returns successfully</b>. Registered after <c>TransactionBehavior</c> so a
/// rolled-back transaction doesn't evict otherwise-valid cache entries (causing the
/// next read to re-populate from the rolled-back state).
/// </summary>
public sealed class CacheInvalidationBehavior<TRequest, TResponse>(
    IDistributedCache cache,
    IOptions<CacheSettings> cacheSettings,
    ILogger<CacheInvalidationBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IDistributedCache _cache = cache ?? throw new ArgumentNullException(nameof(cache));
    private readonly CacheSettings _settings = cacheSettings?.Value ?? throw new ArgumentNullException(nameof(cacheSettings));
    private readonly ILogger<CacheInvalidationBehavior<TRequest, TResponse>> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <inheritdoc />
    public async Task<TResponse> HandleAsync(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(next);

        var response = await next().ConfigureAwait(false);

        if (request is not ICacheInvalidating invalidating)
        {
            return response;
        }

        foreach (var key in invalidating.CacheKeysToInvalidate())
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
#pragma warning disable CA1848
                _logger.LogWarning(ex, "Cache invalidation failed for {Key}", storeKey);
#pragma warning restore CA1848
            }
        }

        return response;
    }
}
