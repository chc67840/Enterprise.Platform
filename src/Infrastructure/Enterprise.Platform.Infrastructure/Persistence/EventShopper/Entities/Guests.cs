using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class Guests
{
    public int Id { get; set; }

    public string GuestToken { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public int? ConvertedToUserId { get; set; }
}
