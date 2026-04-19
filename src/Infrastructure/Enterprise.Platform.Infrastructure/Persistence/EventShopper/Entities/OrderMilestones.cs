using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class OrderMilestones
{
    public Guid Id { get; set; }

    public Guid OrderId { get; set; }

    public string Name { get; set; } = null!;

    public decimal Percentage { get; set; }

    public decimal AmountDue { get; set; }

    public string AmountDueCurrency { get; set; } = null!;

    public decimal AmountPaid { get; set; }

    public string AmountPaidCurrency { get; set; } = null!;

    public string StatusCode { get; set; } = null!;

    public DateTime? DueDate { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual Orders Order { get; set; } = null!;

    public virtual ICollection<Payments> Payments { get; set; } = new List<Payments>();
}
