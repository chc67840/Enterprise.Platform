using Enterprise.Platform.Infrastructure.Persistence.Outbox;
using Microsoft.EntityFrameworkCore;

namespace Enterprise.Platform.Infrastructure.Persistence.App.Contexts;

/// <summary>
/// Customisations layered onto the auto-applied configuration sweep in
/// <see cref="AppDbContext.OnModelCreating"/>. This file owns:
/// <list type="bullet">
///   <item>The platform outbox <see cref="DbSet{TEntity}"/> + table mapping.</item>
///   <item>The soft-delete query filter for <see cref="Domain.Interfaces.ISoftDeletable"/> entities.</item>
/// </list>
/// </summary>
public partial class AppDbContext
{
    /// <summary>
    /// Platform-level outbox. Stored in <c>PlatformOutboxMessages</c>. Written
    /// transactionally by <c>OutboxIntegrationEventPublisher</c>; drained
    /// asynchronously by <c>OutboxProcessorJob</c>.
    /// </summary>
    public DbSet<OutboxMessage> PlatformOutbox => Set<OutboxMessage>();

    /// <summary>Hooked from <see cref="AppDbContext.OnModelCreating"/>.</summary>
    /// <remarks>
    /// CA1822 suppression: declared as instance to satisfy the partial-method contract
    /// in <c>AppDbContext.cs</c>. EF Core invokes it during instance OnModelCreating
    /// regardless.
    /// </remarks>
#pragma warning disable CA1822
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
#pragma warning restore CA1822
    {
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

        // Apply soft-delete query filter to any entity implementing ISoftDeletable.
        // Single-tenant: no tenant filter needed (multi-tenancy stripped 2026-04-25).
        modelBuilder.ApplySoftDeleteFilter();
    }
}
