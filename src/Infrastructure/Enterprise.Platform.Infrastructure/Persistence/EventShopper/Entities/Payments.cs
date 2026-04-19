using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class Payments
{
    public Guid Id { get; set; }

    public Guid OrderMilestoneId { get; set; }

    public decimal Amount { get; set; }

    public string Currency { get; set; } = null!;

    public string TransactionId { get; set; } = null!;

    public string PaymentMethodCode { get; set; } = null!;

    public DateTime PaidAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual OrderMilestones OrderMilestone { get; set; } = null!;
}
