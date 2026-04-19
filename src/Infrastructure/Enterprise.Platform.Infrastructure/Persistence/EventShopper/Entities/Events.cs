using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class Events
{
    public Guid Id { get; set; }

    public Guid CustomerProfileId { get; set; }

    public string EventTypeCode { get; set; } = null!;

    public string Title { get; set; } = null!;

    public DateTime EventDate { get; set; }

    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual ICollection<Appointments> Appointments { get; set; } = new List<Appointments>();

    public virtual CustomerProfiles CustomerProfile { get; set; } = null!;

    public virtual ICollection<Garments> Garments { get; set; } = new List<Garments>();

    public virtual ICollection<ProductionRequests> ProductionRequests { get; set; } = new List<ProductionRequests>();
}
