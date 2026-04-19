using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class JobCardStageLogs
{
    public Guid Id { get; set; }

    public Guid JobCardId { get; set; }

    public string StageCode { get; set; } = null!;

    public DateTime CompletedAt { get; set; }

    public string? LoggedById { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual JobCards JobCard { get; set; } = null!;
}
