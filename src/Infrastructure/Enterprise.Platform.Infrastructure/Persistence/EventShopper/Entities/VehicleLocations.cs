using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class VehicleLocations
{
    public Guid Id { get; set; }

    public Guid AppointmentId { get; set; }

    public float Latitude { get; set; }

    public float Longitude { get; set; }

    public float? Heading { get; set; }

    public float? SpeedKmh { get; set; }

    public int? EstimatedArrivalMinutes { get; set; }

    public DateTime LastUpdatedAt { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }
}
