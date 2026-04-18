using System.Text.Json;
using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Application.Behaviors;

/// <summary>
/// Pipeline order 6 — cache-aside read-through for requests tagged with
/// <see cref="ICacheable"/>. On hit, the downstream handler is skipped entirely
/// (<c>next()</c> is never invoked); on miss, the handler runs and its result is
/// serialized to the store with the region or default TTL. Tenant id is never
/// appended automatically — <see cref="ICacheable.CacheKey"/> must include it when
/// relevant.
/// </summary>
public sealed class CachingBehavior<TRequest, TResponse>(
    IDistributedCache cache,
    IOptions<CacheSettings> options,
    ILogger<CachingBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly CacheSettings _settings = options.Value;

    /// <inheritdoc />
    public async Task<TResponse> HandleAsync(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(next);

        if (request is not ICacheable cacheable)
        {
            return await next().ConfigureAwait(false);
        }

        var storeKey = $"{_settings.KeyPrefix}:{cacheable.CacheKey}";
        var cached = await cache.GetAsync(storeKey, cancellationToken).ConfigureAwait(false);
        if (cached is not null)
        {
            try
            {
                var hit = JsonSerializer.Deserialize<TResponse>(cached);
                if (hit is not null)
                {
                    logger.CacheHit(storeKey);
                    return hit;
                }
            }
            catch (JsonException ex)
            {
                logger.CacheEntryCorrupt(ex, storeKey);
            }
        }

        var response = await next().ConfigureAwait(false);

        var ttl = cacheable.Ttl
            ?? (cacheable.CacheRegion is { } region && _settings.Regions.TryGetValue(region, out var regionTtl)
                ? regionTtl
                : _settings.DefaultTtl);

        try
        {
            var payload = JsonSerializer.SerializeToUtf8Bytes(response);
            await cache.SetAsync(
                storeKey,
                payload,
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl },
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception writeEx) when (writeEx is not OperationCanceledException)
        {
            logger.CacheWriteFailed(writeEx, storeKey);
        }

        return response;
    }
}
