using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Common.Extensions;
using Enterprise.Platform.Application.Common.Interfaces;
using Enterprise.Platform.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Application.Behaviors;

/// <summary>
/// Pipeline order 7 — innermost. Guarantees that commands tagged with
/// <see cref="IIdempotent"/> run <b>at most once</b> within their
/// <see cref="IIdempotent.IdempotencyWindow"/> for a given
/// <see cref="IIdempotent.IdempotencyKey"/>. Race-free: the first caller to win
/// <see cref="IIdempotencyStore.TryAcquireAsync"/> runs the handler; concurrent
/// callers read the cached response. Failures release the lock so the next retry
/// can try again cleanly.
/// </summary>
public sealed class IdempotencyBehavior<TRequest, TResponse>(
    IIdempotencyStore store,
    ICurrentUserService currentUser,
    ILogger<IdempotencyBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    /// <inheritdoc />
    public async Task<TResponse> HandleAsync(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(next);

        if (request is not IIdempotent idempotent)
        {
            return await next().ConfigureAwait(false);
        }

        var storeKey = BuildKey(idempotent.IdempotencyKey);
        var window = idempotent.IdempotencyWindow;

        // Atomic reservation. If we lose, someone else is (or was) running the same
        // command — wait briefly for their response, then return it. The small retry
        // loop tolerates a narrow window where the winner has acquired the lock but
        // not yet written the response.
        var acquired = await store.TryAcquireAsync(storeKey, window, cancellationToken).ConfigureAwait(false);
        if (!acquired)
        {
            for (var attempt = 0; attempt < 10; attempt++)
            {
                var cached = await store.TryGetAsync<TResponse>(storeKey, cancellationToken).ConfigureAwait(false);
                if (cached is not null)
                {
                    logger.IdempotencyHit(typeof(TRequest).Name);
                    return cached;
                }

                await Task.Delay(100, cancellationToken).ConfigureAwait(false);
            }

            // Concurrent caller still didn't finish. Rather than blocking indefinitely,
            // fail fast so the caller can retry later.
            throw new TimeoutException(
                $"Idempotent operation for key '{idempotent.IdempotencyKey}' is still in-progress in another request.");
        }

        TResponse response;
        try
        {
            response = await next().ConfigureAwait(false);
        }
        catch
        {
            // Release the reservation so the next retry can acquire cleanly.
            try
            {
                await store.RemoveAsync(storeKey, CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception removeEx) when (removeEx is not OperationCanceledException)
            {
                logger.IdempotencyWriteFailed(removeEx, typeof(TRequest).Name);
            }

            throw;
        }

        try
        {
            await store.SetAsync(storeKey, response, window, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception writeEx) when (writeEx is not OperationCanceledException)
        {
            logger.IdempotencyWriteFailed(writeEx, typeof(TRequest).Name);
        }

        return response;
    }

    private string BuildKey(string suppliedKey)
    {
        var principal = currentUser.UserId?.ToString("N") ?? "anonymous";
        var seed = $"idem:{typeof(TRequest).FullName}:{principal}:{suppliedKey}";
        return seed.ToSha256Hex();
    }
}
