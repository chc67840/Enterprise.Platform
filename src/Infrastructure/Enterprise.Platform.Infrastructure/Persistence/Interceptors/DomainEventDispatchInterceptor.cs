using Enterprise.Platform.Domain.Aggregates;
using Enterprise.Platform.Domain.Events;
using Enterprise.Platform.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Enterprise.Platform.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Dispatches <see cref="IDomainEvent"/>s raised by aggregates <b>after</b>
/// <c>SaveChanges</c> commits. Handlers therefore observe committed state. Trade-off:
/// a failing event handler cannot roll back the already-committed write — handlers
/// must be idempotent, and high-value fan-out should go through the outbox
/// (Phase 7) instead of the in-process dispatcher.
/// </summary>
public sealed class DomainEventDispatchInterceptor(
    IDomainEventDispatcher dispatcher) : SaveChangesInterceptor
{
    /// <inheritdoc />
    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        await DispatchDomainEventsAsync(eventData.Context, cancellationToken).ConfigureAwait(false);
        return await base.SavedChangesAsync(eventData, result, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        // Synchronous save path — run dispatch on the calling thread. Interceptors have no
        // sync alternative to DispatchAsync; using GetAwaiter().GetResult() would deadlock
        // in SynchronizationContext-bound hosts, so we unwrap from Task.Run off-thread.
        Task.Run(() => DispatchDomainEventsAsync(eventData.Context, CancellationToken.None)).GetAwaiter().GetResult();
        return base.SavedChanges(eventData, result);
    }

    private async Task DispatchDomainEventsAsync(DbContext? context, CancellationToken cancellationToken)
    {
        if (context is null)
        {
            return;
        }

        var aggregates = context.ChangeTracker
            .Entries<AggregateRoot>()
            .Where(e => e.Entity.DomainEvents.Count != 0)
            .Select(e => e.Entity)
            .ToList();

        if (aggregates.Count == 0)
        {
            return;
        }

        // Drain events *before* dispatch so re-entrant saves (rare) don't re-emit the same set.
        var events = new List<IDomainEvent>();
        foreach (var aggregate in aggregates)
        {
            events.AddRange(aggregate.DomainEvents);
            aggregate.ClearDomainEvents();
        }

        await dispatcher.DispatchAsync(events, cancellationToken).ConfigureAwait(false);
    }
}
