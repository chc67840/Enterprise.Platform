using System;
using System.Collections.Generic;
using Enterprise.Platform.Infrastructure.Persistence.App.Entities;
using Microsoft.EntityFrameworkCore;

namespace Enterprise.Platform.Infrastructure.Persistence.App.Contexts;

public partial class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<PlatformOutboxMessage> PlatformOutboxMessage { get; set; }

    public virtual DbSet<User> User { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PlatformOutboxMessage>(entity =>
        {
            entity.HasIndex(e => new { e.PublishedAt, e.NextAttemptAt }, "IX_PlatformOutboxMessage_PublishedAt_NextAttemptAt");

            entity.Property(e => e.Id).HasDefaultValueSql("(newsequentialid())");
            entity.Property(e => e.CorrelationId).HasMaxLength(128);
            entity.Property(e => e.EventType).HasMaxLength(512);
            entity.Property(e => e.NextAttemptAt).HasDefaultValueSql("(sysutcdatetime())", "DF_PlatformOutboxMessage_NextAttemptAt");
            entity.Property(e => e.OccurredAt).HasDefaultValueSql("(sysutcdatetime())", "DF_PlatformOutboxMessage_OccurredAt");
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.TraceId).HasMaxLength(128);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => e.Email, "IX_User_Email").IsUnique();

            entity.HasIndex(e => e.ExternalIdentityId, "UX_User_ExternalIdentityId")
                .IsUnique()
                .HasFilter("([ExternalIdentityId] IS NOT NULL)");

            entity.Property(e => e.Id).HasDefaultValueSql("(newsequentialid())");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())", "DF_User_CreatedAt");
            entity.Property(e => e.CreatedBy).HasMaxLength(256);
            entity.Property(e => e.DeletedBy).HasMaxLength(256);
            entity.Property(e => e.Email).HasMaxLength(254);
            entity.Property(e => e.FirstName).HasMaxLength(100);
            entity.Property(e => e.IsActive).HasDefaultValue(true, "DF_User_IsActive");
            entity.Property(e => e.LastName).HasMaxLength(100);
            entity.Property(e => e.ModifiedAt).HasDefaultValueSql("(sysutcdatetime())", "DF_User_ModifiedAt");
            entity.Property(e => e.ModifiedBy).HasMaxLength(256);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
