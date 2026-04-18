using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Common.Extensions;
using Enterprise.Platform.Application.Common.Interfaces;
using Enterprise.Platform.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Application.Behaviors;

/// <summary>
/// Pipeline order 7 — innermost. Short-circuits commands tagged with
/// <see cref="IIdempotent"/> when the supplied <see cref="IIdempotent.IdempotencyKey"/>
/// matches a previously-stored response. Store keys are namespaced by request type
/// and principal id so distinct callers can safely share idempotency keys.
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

        var hit = await store.TryGetAsync<TResponse>(storeKey, cancellationToken).ConfigureAwait(false);
        if (hit is not null)
        {
            logger.IdempotencyHit(typeof(TRequest).Name);
            return hit;
        }

        var response = await next().ConfigureAwait(false);

        try
        {
            await store.SetAsync(storeKey, response, idempotent.IdempotencyWindow, cancellationToken)
                .ConfigureAwait(false);
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
