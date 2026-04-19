using Enterprise.Platform.Application.Common.Interfaces;
using Enterprise.Platform.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Enterprise.Platform.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Stamps <see cref="IAuditableEntity"/> metadata (<c>CreatedAt/By</c>, <c>ModifiedAt/By</c>)
/// on every <c>SaveChanges</c>. Runs before the provider flushes so the values ship
/// in the same round-trip. Anonymous requests record <c>system</c> as the actor.
/// </summary>
public sealed class AuditableEntityInterceptor(
    IDateTimeProvider dateTime,
    ICurrentUserService currentUser) : SaveChangesInterceptor
{
    private const string SystemActor = "system";

    /// <inheritdoc />
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        ApplyAuditMetadata(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    /// <inheritdoc />
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        ApplyAuditMetadata(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void ApplyAuditMetadata(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        var now = dateTime.UtcNow;
        var actor = currentUser.UserId?.ToString("D") ?? SystemActor;

        foreach (var entry in context.ChangeTracker.Entries<IAuditableEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = now;
                    entry.Entity.CreatedBy = actor;
                    entry.Entity.ModifiedAt = null;
                    entry.Entity.ModifiedBy = null;
                    break;
                case EntityState.Modified:
                    // Guard against accidental CreatedBy/At overwrite by rebinding to original values.
                    entry.Property(nameof(IAuditableEntity.CreatedAt)).IsModified = false;
                    entry.Property(nameof(IAuditableEntity.CreatedBy)).IsModified = false;
                    entry.Entity.ModifiedAt = now;
                    entry.Entity.ModifiedBy = actor;
                    break;
                default:
                    // Unchanged / Deleted / Detached — nothing to stamp.
                    break;
            }
        }

        _ = (PropertyEntry?)null; // keep System.Reflection / ChangeTracking using active.
    }
}
