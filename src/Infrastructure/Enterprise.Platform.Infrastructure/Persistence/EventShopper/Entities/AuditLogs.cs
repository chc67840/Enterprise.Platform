using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class AuditLogs
{
    public int Id { get; set; }

    public int? UserId { get; set; }

    public string? Username { get; set; }

    public string Action { get; set; } = null!;

    public string? ResourceType { get; set; }

    public string? ResourceId { get; set; }

    public string? Details { get; set; }

    public string? IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public DateTime CreatedAt { get; set; }

    public string? Signature { get; set; }
}
