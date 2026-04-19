using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class ChatSessions
{
    public Guid Id { get; set; }

    public Guid JobCardId { get; set; }

    public Guid CustomerProfileId { get; set; }

    public string? TailorId { get; set; }

    public bool IsActive { get; set; }

    public DateTime StartedAt { get; set; }

    public DateTime? ClosedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual ICollection<ChatMessages> ChatMessages { get; set; } = new List<ChatMessages>();

    public virtual CustomerProfiles CustomerProfile { get; set; } = null!;

    public virtual ProductionRequests JobCard { get; set; } = null!;
}
