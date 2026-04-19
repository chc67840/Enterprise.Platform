using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class MemberMeasurements
{
    public Guid Id { get; set; }

    public Guid FamilyMemberId { get; set; }

    public Guid MeasurementAttributeId { get; set; }

    public decimal MeasuredValue { get; set; }

    public DateTime RecordedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual FamilyMembers FamilyMember { get; set; } = null!;
}
