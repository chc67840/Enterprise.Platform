using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class ProductionRequests
{
    public Guid Id { get; set; }

    public Guid FamilyMemberId { get; set; }

    public Guid? EventId { get; set; }

    public Guid? FulfillmentOrderId { get; set; }

    public string GarmentTypeCode { get; set; } = null!;

    public string CurrentStatusCode { get; set; } = null!;

    public DateTime TargetDate { get; set; }

    public string? FabricDetails { get; set; }

    public string? DesignNotes { get; set; }

    public string? AssignedWorkerId { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual ICollection<ChatSessions> ChatSessions { get; set; } = new List<ChatSessions>();

    public virtual Events? Event { get; set; }

    public virtual FamilyMembers FamilyMember { get; set; } = null!;

    public virtual FulfillmentOrders? FulfillmentOrder { get; set; }

    public virtual ICollection<ProductionRequestStageLogs> ProductionRequestStageLogs { get; set; } = new List<ProductionRequestStageLogs>();
}
