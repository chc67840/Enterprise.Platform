using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class Referrals
{
    public Guid Id { get; set; }

    public Guid ReferrerProfileId { get; set; }

    public string ReferralCode { get; set; } = null!;

    public string ReferredName { get; set; } = null!;

    public string ReferredPhone { get; set; } = null!;

    public string StatusCode { get; set; } = null!;

    public string StatusDisplay { get; set; } = null!;

    public bool RewardCredited { get; set; }

    public decimal RewardAmount { get; set; }

    public string RewardCurrency { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }
}
