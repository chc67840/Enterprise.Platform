using Enterprise.Platform.Domain.Aggregates;
using Enterprise.Platform.Domain.Events;
using Enterprise.Platform.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace Enterprise.Platform.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Dispatches <see cref="IDomainEvent"/>s raised by aggregates <b>after</b>
/// <c>SaveChanges</c> commits. Handlers therefore observe committed state. Trade-off:
/// a failing event handler cannot roll back the already-committed write — handlers
/// must be idempotent, and high-value fan-out should go through the outbox
/// (Phase 7) instead of the in-process dispatcher.
/// </summary>
/// <remarks>
/// <b>Pool-safe.</b> <see cref="IDomainEventDispatcher"/> is resolved per-save via
/// the context's scoped service provider. The dispatcher is typically scoped so
/// any handlers it fans out to see the active request's DI graph — capturing it
/// in the ctor would pin the first request's scope for the pool slot's lifetime.
/// </remarks>
public sealed class DomainEventDispatchInterceptor : SaveChangesInterceptor
{
    /// <inheritdoc />
    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        await DispatchDomainEventsAsync(eventData.Context, cancellationToken).ConfigureAwait(false);
        return await base.SavedChangesAsync(eventData, result, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        // Synchronous save path — run dispatch on the calling thread. Interceptors have no
        // sync alternative to DispatchAsync; using GetAwaiter().GetResult() would deadlock
        // in SynchronizationContext-bound hosts, so we unwrap from Task.Run off-thread.
        Task.Run(() => DispatchDomainEventsAsync(eventData.Context, CancellationToken.None)).GetAwaiter().GetResult();
        return base.SavedChanges(eventData, result);
    }

    private static async Task DispatchDomainEventsAsync(DbContext? context, CancellationToken cancellationToken)
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

        var dispatcher = context.GetService<IDomainEventDispatcher>();
        await dispatcher.DispatchAsync(events, cancellationToken).ConfigureAwait(false);
    }
}
