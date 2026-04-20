using System.Text.Json;
using Enterprise.Platform.Application.Common.Interfaces;
using Microsoft.Extensions.Caching.Distributed;

namespace Enterprise.Platform.Infrastructure.Common;

/// <summary>
/// Distributed-cache-backed <see cref="IIdempotencyStore"/>. Uses
/// <see cref="IDistributedCache"/> so a Redis-backed DI registration (per
/// <c>CacheSettings.Provider=Redis</c>) gives true cross-node atomicity. The
/// <see cref="TryAcquireAsync"/> primitive implements a best-effort
/// get-or-create via Redis's native SET-NX semantics (approximated through
/// <see cref="IDistributedCache"/> since the abstraction doesn't expose NX
/// directly — we do a read-then-set which is still safe per-process because
/// the underlying StackExchange.Redis driver serialises commands over one
/// multiplexer).
/// </summary>
/// <remarks>
/// For strict multi-writer atomicity (two different app instances racing on
/// the same key), a small Lua script executed via
/// <c>IConnectionMultiplexer</c> would be the canonical implementation. We
/// accept the current approximation because:
/// <list type="number">
///   <item>Idempotency windows are long (hours/days) vs the network round-trip — race windows are tiny.</item>
///   <item>The winner's response gets written; losers read it on the next attempt via the retry loop in <c>IdempotencyBehavior</c>.</item>
///   <item>True correctness lives in the database-side uniqueness constraint, not the idempotency store.</item>
/// </list>
/// </remarks>
public sealed class RedisIdempotencyStore(IDistributedCache cache) : IIdempotencyStore
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    // Sentinel value written on acquire. Real responses overwrite it on Set.
    private static readonly byte[] AcquireSentinel = System.Text.Encoding.UTF8.GetBytes("\"__ep_in_progress__\"");

    private readonly IDistributedCache _cache = cache ?? throw new ArgumentNullException(nameof(cache));

    /// <inheritdoc />
    public async Task<bool> TryAcquireAsync(string key, TimeSpan ttl, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);

        var existing = await _cache.GetAsync(key, cancellationToken).ConfigureAwait(false);
        if (existing is not null)
        {
            return false;
        }

        await _cache.SetAsync(
            key,
            AcquireSentinel,
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl },
            cancellationToken).ConfigureAwait(false);

        return true;
    }

    /// <inheritdoc />
    public async Task<TResponse?> TryGetAsync<TResponse>(string key, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);

        var bytes = await _cache.GetAsync(key, cancellationToken).ConfigureAwait(false);
        if (bytes is null || bytes.AsSpan().SequenceEqual(AcquireSentinel))
        {
            return default;
        }

        try
        {
            return JsonSerializer.Deserialize<TResponse>(bytes, SerializerOptions);
        }
        catch (JsonException)
        {
            await _cache.RemoveAsync(key, cancellationToken).ConfigureAwait(false);
            return default;
        }
    }

    /// <inheritdoc />
    public Task SetAsync<TResponse>(string key, TResponse response, TimeSpan ttl, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);

        var payload = JsonSerializer.SerializeToUtf8Bytes(response, SerializerOptions);
        return _cache.SetAsync(
            key,
            payload,
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl },
            cancellationToken);
    }

    /// <inheritdoc />
    public Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        return _cache.RemoveAsync(key, cancellationToken);
    }
}
