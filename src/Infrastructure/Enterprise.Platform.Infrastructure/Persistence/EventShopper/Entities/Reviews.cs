using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class Reviews
{
    public Guid Id { get; set; }

    public Guid CustomerProfileId { get; set; }

    public Guid? OrderId { get; set; }

    public int Rating { get; set; }

    public string Title { get; set; } = null!;

    public string Body { get; set; } = null!;

    public string? GarmentTypeCode { get; set; }

    public bool IsPublished { get; set; }

    public string IdempotencyKey { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }
}
