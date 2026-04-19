using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class JobCards
{
    public Guid Id { get; set; }

    public Guid GarmentId { get; set; }

    public string? TailorId { get; set; }

    public string CurrentStageCode { get; set; } = null!;

    public DateTime TargetDate { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual Garments Garment { get; set; } = null!;

    public virtual ICollection<JobCardStageLogs> JobCardStageLogs { get; set; } = new List<JobCardStageLogs>();
}
