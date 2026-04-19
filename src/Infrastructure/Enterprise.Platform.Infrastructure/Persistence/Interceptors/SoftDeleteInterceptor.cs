using Enterprise.Platform.Application.Common.Interfaces;
using Enterprise.Platform.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Enterprise.Platform.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Converts <c>DELETE</c> intents against <see cref="ISoftDeletable"/> entities into
/// logical deletions: the entity transitions from <see cref="EntityState.Deleted"/>
/// to <see cref="EntityState.Modified"/> with <see cref="ISoftDeletable.IsDeleted"/>
/// flipped. Pairs with a global query filter (configured per-entity) that hides
/// <see cref="ISoftDeletable.IsDeleted"/>==<c>true</c> rows from normal reads.
/// </summary>
public sealed class SoftDeleteInterceptor(
    IDateTimeProvider dateTime,
    ICurrentUserService currentUser) : SaveChangesInterceptor
{
    private const string SystemActor = "system";

    /// <inheritdoc />
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        FlipDeletes(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    /// <inheritdoc />
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        FlipDeletes(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void FlipDeletes(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        var now = dateTime.UtcNow;
        var actor = currentUser.UserId?.ToString("D") ?? SystemActor;

        foreach (var entry in context.ChangeTracker.Entries<ISoftDeletable>())
        {
            if (entry.State != EntityState.Deleted)
            {
                continue;
            }

            entry.State = EntityState.Modified;
            entry.Entity.IsDeleted = true;
            entry.Entity.DeletedAt = now;
            entry.Entity.DeletedBy = actor;
        }
    }
}
