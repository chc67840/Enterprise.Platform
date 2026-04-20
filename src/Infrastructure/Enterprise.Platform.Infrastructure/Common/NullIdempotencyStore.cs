using Enterprise.Platform.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Infrastructure.Common;

/// <summary>
/// No-op <see cref="IIdempotencyStore"/>. <see cref="TryAcquireAsync"/> always
/// returns <c>true</c> (caller always wins), <see cref="TryGetAsync{TResponse}"/>
/// always misses, <see cref="SetAsync{TResponse}"/> and <see cref="RemoveAsync"/>
/// are no-ops — so idempotent commands effectively run without de-duplication.
/// Registered as the fallback so <c>IdempotencyBehavior</c> composes cleanly when
/// neither in-memory nor Redis is wired; the <see cref="InMemoryIdempotencyStore"/>
/// replaces it in the default DI path.
/// </summary>
public sealed class NullIdempotencyStore(ILogger<NullIdempotencyStore> logger) : IIdempotencyStore
{
    private readonly ILogger<NullIdempotencyStore> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <inheritdoc />
    public Task<bool> TryAcquireAsync(string key, TimeSpan ttl, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        return Task.FromResult(true);
    }

    /// <inheritdoc />
    public Task<TResponse?> TryGetAsync<TResponse>(string key, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        _logger.IdempotencyStoreMiss(key);
        return Task.FromResult(default(TResponse));
    }

    /// <inheritdoc />
    public Task SetAsync<TResponse>(string key, TResponse response, TimeSpan ttl, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        return Task.CompletedTask;
    }
}
