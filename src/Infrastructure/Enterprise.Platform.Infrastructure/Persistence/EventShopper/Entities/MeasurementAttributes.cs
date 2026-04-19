using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class MeasurementAttributes
{
    public Guid Id { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Unit { get; set; }

    public virtual ICollection<GarmentMeasurementMaps> GarmentMeasurementMaps { get; set; } = new List<GarmentMeasurementMaps>();
}
