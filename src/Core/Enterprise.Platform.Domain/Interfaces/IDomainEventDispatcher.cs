using Enterprise.Platform.Domain.Events;

namespace Enterprise.Platform.Domain.Interfaces;

/// <summary>
/// Dispatches in-process <see cref="IDomainEvent"/>s raised by aggregates. Called by
/// the EF Core <c>DomainEventDispatchInterceptor</c> after a successful
/// <c>SaveChangesAsync</c>, so handlers observe committed state but still run inside
/// the request's service scope.
/// </summary>
public interface IDomainEventDispatcher
{
    /// <summary>Dispatches a single event.</summary>
    Task DispatchAsync(IDomainEvent domainEvent, CancellationToken cancellationToken = default);

    /// <summary>Dispatches a batch of events in declared order.</summary>
    Task DispatchAsync(IEnumerable<IDomainEvent> domainEvents, CancellationToken cancellationToken = default);
}
