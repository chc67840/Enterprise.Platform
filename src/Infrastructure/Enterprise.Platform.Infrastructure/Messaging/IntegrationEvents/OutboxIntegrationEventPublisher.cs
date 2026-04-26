using System.Text.Json;
using Enterprise.Platform.Domain.Events;
using Enterprise.Platform.Infrastructure.Persistence.App.Contexts;
using Enterprise.Platform.Infrastructure.Persistence.Outbox;
using Microsoft.AspNetCore.Http;

namespace Enterprise.Platform.Infrastructure.Messaging.IntegrationEvents;

/// <summary>
/// Real <see cref="IIntegrationEventPublisher"/> — persists the event to the outbox
/// inside the caller's transaction so the "publish" only commits alongside the
/// originating domain changes. Actual transmission happens asynchronously from
/// <c>OutboxProcessorJob</c>. Replaces <c>NullIntegrationEventPublisher</c> whenever
/// outbox is wired (post-Stage-4 hardening).
/// </summary>
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

        var message = new OutboxMessage
        {
            Id = integrationEvent.EventId == Guid.Empty ? Guid.NewGuid() : integrationEvent.EventId,
            EventType = integrationEvent.EventType,
            Payload = payload,
            CreatedAt = integrationEvent.OccurredOn.UtcDateTime,
            CorrelationId = ResolveCorrelationId(),
        };

        await _context.PlatformOutbox.AddAsync(message, cancellationToken).ConfigureAwait(false);
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
