using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class OtpEntries
{
    public int Id { get; set; }

    public string PhoneNumber { get; set; } = null!;

    public string CodeHash { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime ExpiresAt { get; set; }

    public bool IsUsed { get; set; }

    public DateTime? UsedAt { get; set; }

    public int AttemptCount { get; set; }
}
