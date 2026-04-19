using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class ScreenMappings
{
    public Guid Id { get; set; }

    public int RoleId { get; set; }

    public string ScreenKey { get; set; } = null!;

    public bool IsVisible { get; set; }

    public int SortOrder { get; set; }
}
