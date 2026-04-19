using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class SystemCodes
{
    public Guid Id { get; set; }

    public Guid CategoryId { get; set; }

    public string Code { get; set; } = null!;

    public string DisplayValue { get; set; } = null!;

    public int SortOrder { get; set; }

    public bool IsActive { get; set; }

    public virtual SystemCategories Category { get; set; } = null!;
}
