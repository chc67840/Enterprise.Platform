namespace Enterprise.Platform.Application.Common.Interfaces;

/// <summary>
/// Short-term store of previously-observed idempotency keys and their responses.
/// Consumed by <c>IdempotencyBehavior</c> to de-duplicate retries. Infrastructure
/// implementation uses <c>IDistributedCache</c> (Redis in prod, in-memory in dev).
/// </summary>
public interface IIdempotencyStore
{
    /// <summary>Returns the cached response for <paramref name="key"/>, or <c>default</c> when absent.</summary>
    Task<TResponse?> TryGetAsync<TResponse>(string key, CancellationToken cancellationToken = default);

    /// <summary>Stores <paramref name="response"/> for <paramref name="ttl"/>.</summary>
    Task SetAsync<TResponse>(
        string key,
        TResponse response,
        TimeSpan ttl,
        CancellationToken cancellationToken = default);
}
