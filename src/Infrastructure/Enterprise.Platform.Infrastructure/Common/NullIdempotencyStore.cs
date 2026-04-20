using Enterprise.Platform.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Infrastructure.Common;

/// <summary>
/// Placeholder <see cref="IIdempotencyStore"/> — every lookup misses and every write
/// is a no-op. Registered so <c>IdempotencyBehavior</c> composes cleanly; swap for a
/// Redis-backed implementation (or a PlatformDb table) when idempotency guarantees
/// matter.
/// </summary>
public sealed class NullIdempotencyStore(ILogger<NullIdempotencyStore> logger) : IIdempotencyStore
{
    private readonly ILogger<NullIdempotencyStore> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

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
        // No persistence. Real impl lands with PlatformDb / Redis wiring.
        return Task.CompletedTask;
    }
}
