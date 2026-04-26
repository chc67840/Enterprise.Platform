using System;
using System.Collections.Generic;
using Enterprise.Platform.Domain.Aggregates;

namespace Enterprise.Platform.Infrastructure.Persistence.App.Entities;

public partial class User : AggregateRoot
{
    public string Email { get; set; } = null!;

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    public Guid? ExternalIdentityId { get; set; }

    public bool IsActive { get; set; }

    public DateTimeOffset? LastLoginAt { get; set; }

    public bool IsDeleted { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    public string? DeletedBy { get; set; }
}
