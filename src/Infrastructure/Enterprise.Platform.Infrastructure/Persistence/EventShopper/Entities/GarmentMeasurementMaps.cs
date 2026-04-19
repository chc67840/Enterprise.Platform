using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class GarmentMeasurementMaps
{
    public string GarmentTypeCode { get; set; } = null!;

    public Guid MeasurementAttributeId { get; set; }

    public virtual MeasurementAttributes MeasurementAttribute { get; set; } = null!;
}
