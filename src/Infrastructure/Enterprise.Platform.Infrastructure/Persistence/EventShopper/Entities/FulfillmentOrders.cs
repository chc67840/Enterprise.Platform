using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class FulfillmentOrders
{
    public Guid Id { get; set; }

    public Guid CustomerProfileId { get; set; }

    public string StatusCode { get; set; } = null!;

    public string? TrackingNumber { get; set; }

    public string PickupCode { get; set; } = null!;

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual CustomerProfiles CustomerProfile { get; set; } = null!;

    public virtual ICollection<ProductionRequests> ProductionRequests { get; set; } = new List<ProductionRequests>();
}
