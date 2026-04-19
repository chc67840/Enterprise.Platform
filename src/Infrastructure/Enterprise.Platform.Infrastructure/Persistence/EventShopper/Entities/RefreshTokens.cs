using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class RefreshTokens
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string Token { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime ExpiresAt { get; set; }

    public bool IsRevoked { get; set; }

    public DateTime? RevokedAt { get; set; }

    public string? RevokedReason { get; set; }

    public string? ReplacedByToken { get; set; }

    public bool IsUsed { get; set; }

    public DateTime? UsedAt { get; set; }

    public string IpAddress { get; set; } = null!;

    public string? UserAgent { get; set; }

    public string? ClientId { get; set; }

    public string? Platform { get; set; }

    public Guid TokenFamilyId { get; set; }

    public virtual Users User { get; set; } = null!;
}
