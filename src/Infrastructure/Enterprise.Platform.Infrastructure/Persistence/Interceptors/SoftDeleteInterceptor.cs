using Enterprise.Platform.Application.Common.Interfaces;
using Enterprise.Platform.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace Enterprise.Platform.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Converts <c>DELETE</c> intents against <see cref="ISoftDeletable"/> entities into
/// logical deletions: the entity transitions from <see cref="EntityState.Deleted"/>
/// to <see cref="EntityState.Modified"/> with <see cref="ISoftDeletable.IsDeleted"/>
/// flipped. Pairs with a global query filter (configured per-entity) that hides
/// <see cref="ISoftDeletable.IsDeleted"/>==<c>true</c> rows from normal reads.
/// </summary>
/// <remarks>
/// <b>Pool-safe.</b> <see cref="IDateTimeProvider"/> + <see cref="ICurrentUserService"/>
/// are resolved via the context's scoped service provider at save-time, so the
/// same interceptor attached to every slot of a pooled <c>DbContext</c> still
/// stamps the *current* request's actor.
/// </remarks>
public sealed class SoftDeleteInterceptor : SaveChangesInterceptor
{
    private const string SystemActor = "system";

    /// <inheritdoc />
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        FlipDeletes(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    /// <inheritdoc />
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        FlipDeletes(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private static void FlipDeletes(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        var dateTime = context.GetService<IDateTimeProvider>();
        var currentUser = context.GetService<ICurrentUserService>();

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
