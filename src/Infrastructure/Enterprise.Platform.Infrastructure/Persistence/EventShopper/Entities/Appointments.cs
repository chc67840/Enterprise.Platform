using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class Appointments
{
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public int? StylistId { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public string? AddressStreet { get; set; }

    public string? AddressCity { get; set; }

    public string? AddressState { get; set; }

    public string? AddressPostalCode { get; set; }

    public string? AddressCountry { get; set; }

    public decimal? LocationLatitude { get; set; }

    public decimal? LocationLongitude { get; set; }

    public string StatusCode { get; set; } = null!;

    public string GuestTrackingCode { get; set; } = null!;

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual Events Event { get; set; } = null!;
}
