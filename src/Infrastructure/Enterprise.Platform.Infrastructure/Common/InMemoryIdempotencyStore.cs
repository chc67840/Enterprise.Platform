using System.Collections.Concurrent;
using System.Text.Json;
using Enterprise.Platform.Application.Common.Interfaces;

namespace Enterprise.Platform.Infrastructure.Common;

/// <summary>
/// Process-local atomic <see cref="IIdempotencyStore"/>. Backed by a
/// <see cref="ConcurrentDictionary{TKey,TValue}"/> so <see cref="TryAcquireAsync"/>
/// uses <c>TryAdd</c> for true single-process atomicity. <b>Single-node only</b> —
/// multi-instance deployments need the Redis-backed implementation (SET NX EX) that
/// activates alongside <c>RedisCacheProvider</c>. Stored entries expire lazily on
/// read / write-through compaction.
/// </summary>
public sealed class InMemoryIdempotencyStore : IIdempotencyStore
{
    private readonly ConcurrentDictionary<string, Entry> _store = new(StringComparer.Ordinal);
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    /// <inheritdoc />
    public Task<bool> TryAcquireAsync(string key, TimeSpan ttl, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);

        Expire(key);

        var entry = new Entry(
            Payload: null,
            ExpiresAt: DateTimeOffset.UtcNow.Add(ttl));

        return Task.FromResult(_store.TryAdd(key, entry));
    }

    /// <inheritdoc />
    public Task<TResponse?> TryGetAsync<TResponse>(string key, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);

        Expire(key);

        if (!_store.TryGetValue(key, out var entry) || entry.Payload is null)
        {
            return Task.FromResult(default(TResponse));
        }

        try
        {
            var value = JsonSerializer.Deserialize<TResponse>(entry.Payload, SerializerOptions);
            return Task.FromResult(value);
        }
        catch (JsonException)
        {
            _store.TryRemove(key, out _);
            return Task.FromResult(default(TResponse));
        }
    }

    /// <inheritdoc />
    public Task SetAsync<TResponse>(string key, TResponse response, TimeSpan ttl, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);

        var payload = JsonSerializer.SerializeToUtf8Bytes(response, SerializerOptions);
        var entry = new Entry(payload, DateTimeOffset.UtcNow.Add(ttl));
        _store[key] = entry;
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        _store.TryRemove(key, out _);
        return Task.CompletedTask;
    }

    private void Expire(string key)
    {
        if (_store.TryGetValue(key, out var entry) && entry.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            _store.TryRemove(key, out _);
        }
    }

    private sealed record Entry(byte[]? Payload, DateTimeOffset ExpiresAt);
}
