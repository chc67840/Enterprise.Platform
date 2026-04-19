using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class RolePermissions
{
    public int Id { get; set; }

    public int RoleId { get; set; }

    public int PermissionId { get; set; }

    public DateTime GrantedAt { get; set; }

    public int GrantedBy { get; set; }

    public virtual Permissions Permission { get; set; } = null!;

    public virtual Roles Role { get; set; } = null!;
}
