using Enterprise.Platform.Application.Common.Interfaces;
using Enterprise.Platform.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace Enterprise.Platform.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Stamps <see cref="IAuditableEntity"/> metadata (<c>CreatedAt/By</c>, <c>ModifiedAt/By</c>)
/// on every <c>SaveChanges</c>. Runs before the provider flushes so the values ship
/// in the same round-trip. Anonymous requests record <c>system</c> as the actor.
/// </summary>
/// <remarks>
/// <b>Pool-safe.</b> Dependencies (<see cref="IDateTimeProvider"/> /
/// <see cref="ICurrentUserService"/>) are resolved from the active
/// <see cref="DbContext"/>'s scoped service provider on each save — never captured
/// in the constructor — so the same interceptor instance attached to a pooled
/// <c>DbContext</c> always reads the *current* request's actor. Capturing scoped
/// services in the ctor would pin the first request's principal on every
/// subsequent save through that pool slot.
/// </remarks>
public sealed class AuditableEntityInterceptor : SaveChangesInterceptor
{
    private const string SystemActor = "system";

    /// <inheritdoc />
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        ApplyAuditMetadata(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    /// <inheritdoc />
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        ApplyAuditMetadata(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private static void ApplyAuditMetadata(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        // Resolve per-save so pooled contexts always read the current request's
        // services rather than any stale capture from the first activation.
        var dateTime = context.GetService<IDateTimeProvider>();
        var currentUser = context.GetService<ICurrentUserService>();

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
    }
}
