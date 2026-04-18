using System.Diagnostics.CodeAnalysis;

namespace Enterprise.Platform.Application.Abstractions.Messaging;

/// <summary>
/// Marker for a read-only request that returns <typeparamref name="TResult"/>.
/// Queries do not mutate state and are eligible for <see cref="Behaviors.ICacheable"/>.
/// </summary>
/// <typeparam name="TResult">Query return payload.</typeparam>
[SuppressMessage("Design", "CA1040:Avoid empty interfaces", Justification = "Marker interface that types queries for dispatcher routing.")]
public interface IQuery<TResult>
{
}
