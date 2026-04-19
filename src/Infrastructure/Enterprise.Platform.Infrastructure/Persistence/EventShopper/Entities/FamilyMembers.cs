using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class FamilyMembers
{
    public Guid Id { get; set; }

    public Guid CustomerProfileId { get; set; }

    public string Name { get; set; } = null!;

    public string RelationCode { get; set; } = null!;

    public int? Age { get; set; }

    public string? GenderCode { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual CustomerProfiles CustomerProfile { get; set; } = null!;

    public virtual ICollection<Garments> Garments { get; set; } = new List<Garments>();

    public virtual ICollection<MemberMeasurements> MemberMeasurements { get; set; } = new List<MemberMeasurements>();

    public virtual ICollection<ProductionRequests> ProductionRequests { get; set; } = new List<ProductionRequests>();
}
