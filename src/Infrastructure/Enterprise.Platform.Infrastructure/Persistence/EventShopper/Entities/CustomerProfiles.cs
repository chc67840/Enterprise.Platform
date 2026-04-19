using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class CustomerProfiles
{
    public Guid Id { get; set; }

    public int? AuthUserId { get; set; }

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    public string? PhoneValue { get; set; }

    public string? PhoneNormalized { get; set; }

    public string? Email { get; set; }

    public string? EmailNormalized { get; set; }

    public bool IsRegistered { get; set; }

    public string? GuestToken { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual ICollection<ChatSessions> ChatSessions { get; set; } = new List<ChatSessions>();

    public virtual ICollection<Events> Events { get; set; } = new List<Events>();

    public virtual ICollection<FamilyMembers> FamilyMembers { get; set; } = new List<FamilyMembers>();

    public virtual ICollection<FulfillmentOrders> FulfillmentOrders { get; set; } = new List<FulfillmentOrders>();
}
