using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper.Contexts;
using Enterprise.Platform.Infrastructure.Persistence.Outbox;
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
    /// <summary>
    /// DbSet for the <b>platform-level</b> outbox — distinct from EventShopper's
    /// legacy <c>OutboxMessages</c> table (which stays untouched; see
    /// <c>Entities/OutboxMessages.cs</c>). Stored as <c>PlatformOutboxMessages</c>
    /// so the two coexist without schema collision.
    /// </summary>
    public DbSet<OutboxMessage> PlatformOutbox => Set<OutboxMessage>();

    /// <summary>Hooked by the scaffolded <c>OnModelCreating</c> via the partial method call.</summary>
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        // Platform outbox configuration — co-located here so re-scaffolds don't drop it.
        modelBuilder.Entity<OutboxMessage>(builder =>
        {
            builder.ToTable("PlatformOutboxMessages");
            builder.HasKey(e => e.Id);
            builder.Property(e => e.EventType).HasMaxLength(200).IsRequired();
            builder.Property(e => e.Payload).IsRequired();
            builder.Property(e => e.CorrelationId).HasMaxLength(64);
            builder.HasIndex(e => new { e.PublishedAt, e.NextAttemptAt })
                .HasFilter("[PublishedAt] IS NULL")
                .HasDatabaseName("IX_PlatformOutboxMessages_PublishedAt_NextAttemptAt");
        });

        // `ICurrentTenantService` is registered as Singleton (see DependencyInjection.cs)
        // so this GetService call resolves from the root provider without tripping
        // scope validation — a hard requirement under AddDbContextPool, because a
        // pooled context's ApplicationServiceProvider IS the root container. The
        // returned instance is stateless: its `.TenantId` getter delegates to
        // IHttpContextAccessor (AsyncLocal) on every read, so the accessor delegate
        // captured here always reports the live request's tenant at query-translation
        // time. Null-propagation tolerates background jobs / startup scenarios where
        // no HttpContext exists.
        var currentTenant = this.GetService<ICurrentTenantService>();
        modelBuilder.ApplyTenantAndSoftDeleteFilters(() => currentTenant?.TenantId);
    }
}
