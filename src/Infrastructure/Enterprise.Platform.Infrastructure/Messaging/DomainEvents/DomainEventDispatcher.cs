using Enterprise.Platform.Domain.Events;
using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Infrastructure.Common;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Infrastructure.Messaging.DomainEvents;

/// <summary>
/// In-process <see cref="IDomainEventDispatcher"/>. For each event it resolves every
/// registered <see cref="IDomainEventHandler{TEvent}"/> from the current DI scope
/// and invokes them sequentially. Handler exceptions are logged but do not abort the
/// rest of the batch — domain events observe already-committed state, so partial
/// failure is not catastrophic but observability matters.
/// </summary>
/// <remarks>
/// For cross-service fan-out, prefer the outbox (Phase 7 stub). In-process dispatch
/// is for aggregates reacting to siblings within the same bounded context.
/// </remarks>
public sealed class DomainEventDispatcher(
    IServiceProvider serviceProvider,
    ILogger<DomainEventDispatcher> logger) : IDomainEventDispatcher
{
    private readonly IServiceProvider _serviceProvider = serviceProvider
        ?? throw new ArgumentNullException(nameof(serviceProvider));

    private readonly ILogger<DomainEventDispatcher> _logger = logger
        ?? throw new ArgumentNullException(nameof(logger));

    /// <inheritdoc />
    public async Task DispatchAsync(IDomainEvent domainEvent, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(domainEvent);
        await DispatchInternalAsync(domainEvent, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task DispatchAsync(IEnumerable<IDomainEvent> domainEvents, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(domainEvents);
        foreach (var domainEvent in domainEvents)
        {
            await DispatchInternalAsync(domainEvent, cancellationToken).ConfigureAwait(false);
        }
    }

    private async Task DispatchInternalAsync(IDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var eventType = domainEvent.GetType();
        var handlerType = typeof(IDomainEventHandler<>).MakeGenericType(eventType);
        var handlers = _serviceProvider.GetServices(handlerType).Where(h => h is not null).ToArray();

        _logger.DispatchingDomainEvent(eventType.Name, handlers.Length);

        foreach (var handler in handlers)
        {
            try
            {
                var method = handlerType.GetMethod(nameof(IDomainEventHandler<IDomainEvent>.HandleAsync))
                    ?? throw new InvalidOperationException(
                        $"IDomainEventHandler<{eventType.Name}> has no HandleAsync method.");
                var task = (Task)method.Invoke(handler, [domainEvent, cancellationToken])!;
                await task.ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.DomainEventHandlerFailed(ex, handler!.GetType().Name, eventType.Name);
                // Swallow — subsequent handlers still run. Re-throwing would leave the
                // saved aggregate's siblings in an inconsistent state.
            }
        }
    }
}

/// <summary>
/// Contract for an in-process domain-event handler. Implementations are registered in
/// DI as <c>IDomainEventHandler&lt;TEvent&gt;</c> and invoked by
/// <see cref="DomainEventDispatcher"/> after <c>SaveChanges</c> commits.
/// </summary>
/// <typeparam name="TEvent">Concrete event type.</typeparam>
[System.Diagnostics.CodeAnalysis.SuppressMessage(
    "Naming",
    "CA1711:Identifiers should not have incorrect suffix",
    Justification = "`EventHandler` suffix mirrors CQRS/MediatR convention every reader already recognises.")]
public interface IDomainEventHandler<in TEvent> where TEvent : IDomainEvent
{
    /// <summary>Handles <paramref name="domainEvent"/>. Should be idempotent.</summary>
    Task HandleAsync(TEvent domainEvent, CancellationToken cancellationToken = default);
}
