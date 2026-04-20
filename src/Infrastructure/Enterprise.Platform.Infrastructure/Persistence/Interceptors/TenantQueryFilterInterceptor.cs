using Enterprise.Platform.Domain.Exceptions;
using Enterprise.Platform.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace Enterprise.Platform.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Stamps <see cref="ITenantEntity.TenantId"/> on inserts from the current
/// <see cref="ICurrentTenantService.TenantId"/>. The *read* side of tenant isolation
/// is enforced separately via EF global query filters configured per entity type —
/// this interceptor guarantees every persisted row belongs to the caller's tenant.
/// </summary>
/// <remarks>
/// Misnamed historically ("QueryFilter") — kept for parity with the TODO / folder
/// structure; it is strictly a write-side interceptor. Throws
/// <see cref="TenantMismatchException"/> when an insert targets a different tenant
/// than the request's resolved one.
/// <para>
/// <b>Pool-safe.</b> <see cref="ICurrentTenantService"/> is resolved from the
/// context's scoped service provider on each save so tenant enforcement always
/// reads the live request's tenant — crucial once pooled contexts recycle across
/// tenants.
/// </para>
/// </remarks>
public sealed class TenantQueryFilterInterceptor : SaveChangesInterceptor
{
    /// <inheritdoc />
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        StampTenant(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    /// <inheritdoc />
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        StampTenant(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private static void StampTenant(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        var currentTenant = context.GetService<ICurrentTenantService>();
        var resolved = currentTenant.TenantId;

        foreach (var entry in context.ChangeTracker.Entries<ITenantEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    if (entry.Entity.TenantId == Guid.Empty)
                    {
                        if (resolved is null)
                        {
                            throw new TenantMismatchException(
                                "Cannot insert a tenant-scoped entity: no tenant is resolved for the current request.");
                        }

                        entry.Entity.TenantId = resolved.Value;
                    }
                    else if (resolved is { } expected && entry.Entity.TenantId != expected)
                    {
                        throw new TenantMismatchException(expected, entry.Entity.TenantId);
                    }

                    break;
                case EntityState.Modified:
                    // Block cross-tenant updates that bypass the query filter somehow.
                    if (resolved is { } tenantId && entry.Entity.TenantId != tenantId)
                    {
                        throw new TenantMismatchException(tenantId, entry.Entity.TenantId);
                    }

                    entry.Property(nameof(ITenantEntity.TenantId)).IsModified = false;
                    break;
                default:
                    break;
            }
        }
    }
}
