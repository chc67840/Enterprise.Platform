using System.Diagnostics;
using Enterprise.Platform.Domain.Events;
using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Infrastructure.Common;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Serilog.Context;

namespace Enterprise.Platform.Infrastructure.Messaging.DomainEvents;

/// <summary>
/// In-process <see cref="IDomainEventDispatcher"/>. For each event it resolves every
/// registered <see cref="IDomainEventHandler{TEvent}"/> from the current DI scope
/// and invokes them sequentially.
/// </summary>
/// <remarks>
/// <para>
/// <b>Failure semantics.</b> Handlers observe already-committed state (the EF
/// interceptor runs <i>after</i> SaveChanges), so a handler exception cannot roll
/// back the originating write. Per-handler exceptions are logged + swallowed so
/// subsequent handlers still run; the originating command is unaffected.
/// </para>
/// <para>
/// <b>Per-handler timeout (P1-3 audit).</b> Each handler invocation is wrapped in
/// <see cref="HandlerTimeout"/>. Handlers that need longer must split work to the
/// outbox. The timeout fires through a linked CancellationToken so well-behaved
/// handlers can observe the cancellation and abort cleanly.
/// </para>
/// <para>
/// <b>Per-handler observability (P1-3 + P0-1 audit).</b> Each invocation pushes
/// <c>DomainEvent</c> / <c>DomainEventId</c> / <c>DomainEventHandler</c> into
/// <see cref="LogContext"/> and starts an <see cref="Activity"/> so OpenTelemetry +
/// Serilog correlate handler logs back to the originating request. Entry/exit/
/// elapsed are logged at Information level via source-generated
/// <see cref="LogMessages"/> stubs.
/// </para>
/// <para>
/// For cross-service fan-out, prefer the outbox publisher. In-process dispatch is
/// for aggregates reacting to siblings within the same bounded context.
/// </para>
/// </remarks>
public sealed class DomainEventDispatcher(
    IServiceProvider serviceProvider,
    ILogger<DomainEventDispatcher> logger) : IDomainEventDispatcher
{
    /// <summary>
    /// Per-handler maximum execution time. Constants live here (not in settings)
    /// because tightening the budget per-deployment risks production surprise — if a
    /// handler legitimately needs longer it should NOT be in the in-process
    /// dispatcher; it belongs in the outbox.
    /// </summary>
    public static readonly TimeSpan HandlerTimeout = TimeSpan.FromSeconds(10);

    /// <summary>
    /// OpenTelemetry <see cref="ActivitySource"/> for domain-event spans. Spans named
    /// <c>DomainEvent.{EventType}.{HandlerType}</c> nest under the originating
    /// request's activity automatically.
    /// </summary>
    public static readonly ActivitySource ActivitySource = new("Enterprise.Platform.DomainEvents");

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

        // Per-event LogContext property: every handler under this event sees it
        // in its log lines so cross-handler correlation in Seq is trivial.
        using var eventScope = LogContext.PushProperty("DomainEvent", eventType.Name);

        foreach (var handler in handlers)
        {
            await InvokeHandlerAsync(handler!, eventType, handlerType, domainEvent, cancellationToken).ConfigureAwait(false);
        }
    }

    private async Task InvokeHandlerAsync(
        object handler,
        Type eventType,
        Type handlerType,
        IDomainEvent domainEvent,
        CancellationToken cancellationToken)
    {
        var handlerName = handler.GetType().Name;

        using var handlerScope = LogContext.PushProperty("DomainEventHandler", handlerName);
        using var activity = ActivitySource.StartActivity($"DomainEvent.{eventType.Name}.{handlerName}", ActivityKind.Internal);
        activity?.SetTag("event.type", eventType.Name);
        activity?.SetTag("event.occurred_on", domainEvent.OccurredOn);
        activity?.SetTag("handler.type", handlerName);

        using var timeoutCts = new CancellationTokenSource(HandlerTimeout);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

        var stopwatch = Stopwatch.StartNew();
        try
        {
            var method = handlerType.GetMethod(nameof(IDomainEventHandler<IDomainEvent>.HandleAsync))
                ?? throw new InvalidOperationException(
                    $"IDomainEventHandler<{eventType.Name}> has no HandleAsync method.");
            var task = (Task)method.Invoke(handler, [domainEvent, linkedCts.Token])!;
            await task.ConfigureAwait(false);

            stopwatch.Stop();
            activity?.SetStatus(ActivityStatusCode.Ok);
            _logger.DomainEventHandlerSucceeded(handlerName, eventType.Name, stopwatch.ElapsedMilliseconds);
        }
        catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
        {
            stopwatch.Stop();
            activity?.SetStatus(ActivityStatusCode.Error, "Handler timed out");
            _logger.DomainEventHandlerTimedOut(handlerName, HandlerTimeout.TotalSeconds, eventType.Name);
            // Swallow — see class remarks.
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            stopwatch.Stop();
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            _logger.DomainEventHandlerFailed(ex, handlerName, eventType.Name);
            // Swallow — see class remarks.
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
    /// <summary>Handles <paramref name="domainEvent"/>. Must be idempotent and complete within <see cref="DomainEventDispatcher.HandlerTimeout"/>.</summary>
    Task HandleAsync(TEvent domainEvent, CancellationToken cancellationToken = default);
}
