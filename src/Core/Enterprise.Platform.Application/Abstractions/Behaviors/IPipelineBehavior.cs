using System.Diagnostics.CodeAnalysis;

namespace Enterprise.Platform.Application.Abstractions.Behaviors;

/// <summary>
/// Delegate invoked by a <see cref="IPipelineBehavior{TRequest, TResponse}"/> to pass
/// control to the next behavior (or the handler, if it's the last one). The
/// <c>Delegate</c> suffix is intentional — it mirrors the MediatR convention every
/// reader of this code already recognizes.
/// </summary>
/// <typeparam name="TResponse">Response type of the wrapped call.</typeparam>
[SuppressMessage("Naming", "CA1711:Identifiers should not have incorrect suffix", Justification = "Suffix mirrors MediatR's RequestHandlerDelegate convention that handler authors already know.")]
public delegate Task<TResponse> RequestHandlerDelegate<TResponse>();

/// <summary>
/// Cross-cutting concern wrapped around every command / query handler. Behaviors form
/// a chain (registration order is execution order — outer behaviors registered first).
/// Implementations should be stateless; they resolve per-scope.
/// </summary>
/// <typeparam name="TRequest">Request type (<c>ICommand</c> / <c>ICommand&lt;T&gt;</c> / <c>IQuery&lt;T&gt;</c>).</typeparam>
/// <typeparam name="TResponse">Response type.</typeparam>
public interface IPipelineBehavior<in TRequest, TResponse>
    where TRequest : notnull
{
    /// <summary>
    /// Executes this behavior and returns the response. Must call <paramref name="next"/>
    /// exactly once — skipping it short-circuits the pipeline (useful for idempotency
    /// cache hits); calling it twice re-runs the downstream handler.
    /// </summary>
    Task<TResponse> HandleAsync(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken);
}
