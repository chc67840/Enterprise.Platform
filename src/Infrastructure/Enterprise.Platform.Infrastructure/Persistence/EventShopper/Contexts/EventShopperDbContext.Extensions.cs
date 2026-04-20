using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Contexts;

/// <summary>
/// Customisations that survive a re-scaffold. The scaffolded
/// <see cref="EventShopperDbContext"/> overwrites <c>OnModelCreating</c> with
/// <c>--force</c>; this partial hooks <c>OnModelCreatingPartial</c> — which the
/// scaffolder's template invokes — so tenant + soft-delete query filters apply
/// automatically even after re-scaffolds. Scaffolded entities today are DB-first
/// POCOs that don't implement <see cref="ITenantEntity"/> / <see cref="ISoftDeletable"/>,
/// so the helper iterates the model and is a no-op for them. The wiring is ready
/// for the first aggregate that opts in.
/// </summary>
public partial class EventShopperDbContext
{
    /// <summary>Hooked by the scaffolded <c>OnModelCreating</c> via the partial method call.</summary>
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        // The accessor reads the ambient `ICurrentTenantService` resolved from the
        // scoped service provider at query-translation time. The null-propagation
        // tolerates background jobs / startup scenarios where no HttpContext exists.
        // `DbContext` implements `IInfrastructure<IServiceProvider>` explicitly;
        // the EF `AccessorExtensions.GetService<T>` helper reaches into the scoped
        // service provider so interceptors + filters share the request's current tenant.
        var currentTenant = this.GetService<ICurrentTenantService>();
        modelBuilder.ApplyTenantAndSoftDeleteFilters(() => currentTenant?.TenantId);
    }
}
