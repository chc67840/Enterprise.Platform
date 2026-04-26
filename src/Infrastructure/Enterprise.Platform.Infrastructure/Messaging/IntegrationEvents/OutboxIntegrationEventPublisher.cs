using System.Text.Json;
using Enterprise.Platform.Domain.Events;
using Enterprise.Platform.Infrastructure.Persistence.App.Contexts;
using Enterprise.Platform.Infrastructure.Persistence.App.Entities;
using Microsoft.AspNetCore.Http;

namespace Enterprise.Platform.Infrastructure.Messaging.IntegrationEvents;

/// <summary>
/// Real <see cref="IIntegrationEventPublisher"/> — persists the event to the
/// <c>PlatformOutboxMessage</c> table inside the caller's transaction so the
/// "publish" only commits alongside the originating domain changes. Actual
/// transmission happens asynchronously from <c>OutboxProcessorJob</c>.
/// </summary>
/// <remarks>
/// Uses the scaffolded <see cref="PlatformOutboxMessage"/> entity (db-first
/// pivot, Phase A). The pre-pivot hand-authored <c>OutboxMessage</c> class +
/// <c>OutboxSchemaBootstrapper</c> were dropped in Phase C.3 — schema is now
/// owned by <c>infra/db/scripts/App/001-initial.sql</c> + 003.
/// </remarks>
public sealed class OutboxIntegrationEventPublisher(
    AppDbContext context,
    IHttpContextAccessor? httpContextAccessor = null) : IIntegrationEventPublisher
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    private readonly AppDbContext _context = context ?? throw new ArgumentNullException(nameof(context));
    private readonly IHttpContextAccessor? _httpContextAccessor = httpContextAccessor;

    /// <inheritdoc />
    public async Task PublishAsync(IIntegrationEvent integrationEvent, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(integrationEvent);

        var payload = JsonSerializer.Serialize(integrationEvent, integrationEvent.GetType(), SerializerOptions);

        // PlatformOutboxMessage.Create owns the EventId-as-PK dedupe rule —
        // see PlatformOutboxMessage.Behavior.cs for why.
        var message = PlatformOutboxMessage.Create(
            integrationEvent,
            payload,
            ResolveCorrelationId(),
            traceId: System.Diagnostics.Activity.Current?.TraceId.ToString());

        await _context.PlatformOutboxMessage.AddAsync(message, cancellationToken).ConfigureAwait(false);
        // Persistence happens with the caller's SaveChanges / transaction commit —
        // intentional coupling so outbox writes never outlive a rolled-back command.
    }

    private string? ResolveCorrelationId()
    {
        const string itemKey = "ep:correlation_id";
        var ctx = _httpContextAccessor?.HttpContext;
        return ctx?.Items.TryGetValue(itemKey, out var value) == true ? value?.ToString() : null;
    }
}
