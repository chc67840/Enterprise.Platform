using System;
using System.Collections.Generic;
using Enterprise.Platform.Domain.Entities;

namespace Enterprise.Platform.Infrastructure.Persistence.App.Entities;

public partial class PlatformOutboxMessage : BaseEntity
{
    public string EventType { get; set; } = null!;

    public string Payload { get; set; } = null!;

    public DateTimeOffset OccurredAt { get; set; }

    public DateTimeOffset? PublishedAt { get; set; }

    public int AttemptCount { get; set; }

    public DateTimeOffset NextAttemptAt { get; set; }

    public string? LastError { get; set; }

    public string? CorrelationId { get; set; }

    public string? TraceId { get; set; }
}
