using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class Garments
{
    public Guid Id { get; set; }

    public Guid FamilyMemberId { get; set; }

    public Guid? EventId { get; set; }

    public string GarmentTypeCode { get; set; } = null!;

    public string? FabricNotes { get; set; }

    public decimal Price { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual ICollection<AiPreviews> AiPreviews { get; set; } = new List<AiPreviews>();

    public virtual Events? Event { get; set; }

    public virtual FamilyMembers FamilyMember { get; set; } = null!;

    public virtual ICollection<JobCards> JobCards { get; set; } = new List<JobCards>();
}
