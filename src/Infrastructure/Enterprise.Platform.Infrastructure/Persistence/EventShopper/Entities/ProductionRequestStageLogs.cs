using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class ProductionRequestStageLogs
{
    public Guid Id { get; set; }

    public Guid ProductionRequestId { get; set; }

    public string StageCode { get; set; } = null!;

    public DateTime CompletedAt { get; set; }

    public string? LoggedByAuthUserId { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual ProductionRequests ProductionRequest { get; set; } = null!;
}
