using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class SystemSettings
{
    public Guid Id { get; set; }

    public string Key { get; set; } = null!;

    public string Value { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsPublic { get; set; }

    public string DataType { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }
}
