namespace Enterprise.Platform.Domain.Events;

/// <summary>
/// Marker for an event raised from inside the domain boundary. Dispatched
/// in-process by <c>DomainEventDispatchInterceptor</c> after the transaction commits,
/// so handlers run in the same unit of work but see a committed state.
/// </summary>
public interface IDomainEvent
{
    /// <summary>UTC instant the event was raised. Set by the implementor at construction.</summary>
    DateTimeOffset OccurredOn { get; }
}
