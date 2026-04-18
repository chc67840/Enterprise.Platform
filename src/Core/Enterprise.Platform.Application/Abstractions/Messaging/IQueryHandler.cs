namespace Enterprise.Platform.Application.Abstractions.Messaging;

/// <summary>
/// Handles a read-only <see cref="IQuery{TResult}"/>. Handlers must be side-effect-free
/// — the caching pipeline behavior assumes identical queries always yield identical
/// results.
/// </summary>
/// <typeparam name="TQuery">Concrete query type.</typeparam>
/// <typeparam name="TResult">Query return payload.</typeparam>
public interface IQueryHandler<in TQuery, TResult>
    where TQuery : IQuery<TResult>
{
    /// <summary>Executes <paramref name="query"/> and returns its result.</summary>
    Task<TResult> HandleAsync(TQuery query, CancellationToken cancellationToken = default);
}
