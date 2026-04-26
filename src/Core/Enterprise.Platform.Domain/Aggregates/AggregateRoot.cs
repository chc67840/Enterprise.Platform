using Enterprise.Platform.Domain.Entities;
using Enterprise.Platform.Domain.Events;

namespace Enterprise.Platform.Domain.Aggregates;

/// <summary>
/// Root entity of an aggregate — the single consistency boundary through which
/// external callers mutate the graph. Tracks uncommitted <see cref="IDomainEvent"/>s
/// that the infrastructure dispatches after <c>SaveChangesAsync</c> succeeds.
/// </summary>
/// <remarks>
/// Aggregates raise events by calling the <c>protected</c> <see cref="AddDomainEvent"/>
/// from inside their own methods. The infrastructure dispatcher drains events via
/// <see cref="DomainEvents"/>, then calls <see cref="ClearDomainEvents"/> — never
/// inspect or mutate the collection from application code.
/// </remarks>
public abstract class AggregateRoot : AuditableEntity
{
    private readonly List<IDomainEvent> _domainEvents = [];

    /// <summary>
    /// Events raised during this unit of work that have not yet been dispatched.
    /// Read-only view — use <see cref="AddDomainEvent"/> to append and
    /// <see cref="ClearDomainEvents"/> to drain.
    /// </summary>
    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    /// <summary>
    /// Appends <paramref name="domainEvent"/> to the aggregate's pending-events list.
    /// Called by the aggregate's own methods as business rules execute.
    /// </summary>
    protected void AddDomainEvent(IDomainEvent domainEvent)
    {
        ArgumentNullException.ThrowIfNull(domainEvent);
        _domainEvents.Add(domainEvent);
    }

    /// <summary>
    /// Drains the pending-events list. The infrastructure dispatcher calls this after
    /// dispatching, so the same events are not re-sent across units of work.
    /// </summary>
    public void ClearDomainEvents() => _domainEvents.Clear();
}
