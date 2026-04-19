using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class Orders
{
    public Guid Id { get; set; }

    public Guid CustomerProfileId { get; set; }

    public Guid? OccasionEventId { get; set; }

    public decimal TotalAmount { get; set; }

    public string TotalCurrency { get; set; } = null!;

    public string StatusCode { get; set; } = null!;

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual ICollection<OrderMilestones> OrderMilestones { get; set; } = new List<OrderMilestones>();
}
