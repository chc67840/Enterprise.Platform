namespace Enterprise.Platform.Application.Common.Interfaces;

/// <summary>
/// Short-term store of previously-observed idempotency keys and their responses.
/// Consumed by <c>IdempotencyBehavior</c> to de-duplicate retries. The
/// <see cref="TryAcquireAsync"/> primitive is **atomic** — two concurrent callers
/// can't both win. Infrastructure: in-memory (<c>ConcurrentDictionary.TryAdd</c>) in
/// dev, Redis (`SET key value NX EX ttl`) in prod.
/// </summary>
public interface IIdempotencyStore
{
    /// <summary>
    /// Atomically reserves <paramref name="key"/> for <paramref name="ttl"/>. Returns
    /// <c>true</c> when the caller is the first to claim the key (they're responsible
    /// for running the real operation + calling <see cref="SetAsync{TResponse}"/> to
    /// record the response). Returns <c>false</c> when someone else already claimed it
    /// — caller should then <see cref="TryGetAsync{TResponse}"/> for the stored result.
    /// </summary>
    Task<bool> TryAcquireAsync(string key, TimeSpan ttl, CancellationToken cancellationToken = default);

    /// <summary>Returns the cached response for <paramref name="key"/>, or <c>default</c> when absent.</summary>
    Task<TResponse?> TryGetAsync<TResponse>(string key, CancellationToken cancellationToken = default);

    /// <summary>Stores <paramref name="response"/> under <paramref name="key"/> for <paramref name="ttl"/>.</summary>
    Task SetAsync<TResponse>(
        string key,
        TResponse response,
        TimeSpan ttl,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes <paramref name="key"/>. Called by the behavior when the handler throws,
    /// so the next retry isn't permanently blocked by the in-progress sentinel.
    /// </summary>
    Task RemoveAsync(string key, CancellationToken cancellationToken = default);
}
