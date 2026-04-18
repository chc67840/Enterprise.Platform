using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Application.Behaviors;

/// <summary>
/// Pipeline order 5 — wraps requests tagged with <see cref="ITransactional"/> in an
/// explicit unit-of-work transaction. Success path commits; any exception rolls back
/// before re-throwing. Requests without <see cref="ITransactional"/> pass through
/// unchanged (their single <c>SaveChangesAsync</c> is enough).
/// </summary>
public sealed class TransactionBehavior<TRequest, TResponse>(
    IUnitOfWork unitOfWork,
    ILogger<TransactionBehavior<TRequest, TResponse>> logger)
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

        if (request is not ITransactional)
        {
            return await next().ConfigureAwait(false);
        }

        await unitOfWork.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);

        try
        {
            var response = await next().ConfigureAwait(false);
            await unitOfWork.CommitTransactionAsync(cancellationToken).ConfigureAwait(false);
            return response;
        }
        catch
        {
            try
            {
                await unitOfWork.RollbackTransactionAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (Exception rollbackEx) when (rollbackEx is not OperationCanceledException)
            {
                logger.RollbackFailed(rollbackEx, typeof(TRequest).Name);
            }

            throw;
        }
    }
}
