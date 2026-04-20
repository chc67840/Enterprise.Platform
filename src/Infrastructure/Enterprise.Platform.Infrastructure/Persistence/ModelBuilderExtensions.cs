using System.Linq.Expressions;
using Enterprise.Platform.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Enterprise.Platform.Infrastructure.Persistence;

/// <summary>
/// EF Core <see cref="ModelBuilder"/> extensions that apply cross-cutting query
/// filters. These <b>must</b> be called from each <c>DbContext</c>'s
/// <c>OnModelCreating</c> — EF doesn't compose filters across contexts automatically.
/// </summary>
/// <remarks>
/// Paired with the write-side Phase-5 interceptors (<c>TenantQueryFilterInterceptor</c>
/// + <c>SoftDeleteInterceptor</c>). Together: writes are stamped, reads are masked.
/// Together they close the tenant-isolation + soft-delete invariants for
/// <see cref="ITenantEntity"/> / <see cref="ISoftDeletable"/> entities.
/// </remarks>
public static class ModelBuilderExtensions
{
    /// <summary>
    /// Iterates every registered entity type and conditionally applies:
    /// <list type="bullet">
    ///   <item>A tenant filter — <c>e.TenantId == currentTenant.TenantId</c> — when <typeparamref name="ITenantEntity"/> is implemented.</item>
    ///   <item>A soft-delete filter — <c>e.IsDeleted == false</c> — when <typeparamref name="ISoftDeletable"/> is implemented.</item>
    /// </list>
    /// When an entity implements both, the filters are ANDed.
    /// </summary>
    /// <param name="modelBuilder">The EF model builder.</param>
    /// <param name="tenantAccessor">
    /// Resolver that returns the current tenant id at query-translation time. Capturing
    /// <c>ICurrentTenantService</c> directly in the lambda would cache the tenant at
    /// startup — that's wrong. Instead, pass a delegate that reads the ambient service
    /// each call, or rely on EF's runtime-parameter rewriting.
    /// </param>
    public static ModelBuilder ApplyTenantAndSoftDeleteFilters(
        this ModelBuilder modelBuilder,
        Func<Guid?> tenantAccessor)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);
        ArgumentNullException.ThrowIfNull(tenantAccessor);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            var clrType = entityType.ClrType;
            var isTenanted = typeof(ITenantEntity).IsAssignableFrom(clrType);
            var isSoftDeletable = typeof(ISoftDeletable).IsAssignableFrom(clrType);

            if (!isTenanted && !isSoftDeletable)
            {
                continue;
            }

            var parameter = Expression.Parameter(clrType, "e");
            Expression? body = null;

            if (isTenanted)
            {
                // e.TenantId == tenantAccessor()  — expressed as a MethodCallExpression to
                // the accessor delegate so EF re-evaluates on every query execution.
                var tenantProp = Expression.Property(parameter, nameof(ITenantEntity.TenantId));
                var accessorCall = Expression.Call(
                    Expression.Constant(tenantAccessor.Target, tenantAccessor.Target?.GetType() ?? typeof(object)),
                    tenantAccessor.Method);
                var tenantValue = Expression.Property(accessorCall, nameof(Nullable<Guid>.Value));
                var hasValue = Expression.Property(accessorCall, nameof(Nullable<Guid>.HasValue));

                // (tenantAccessor().HasValue == false) || e.TenantId == tenantAccessor().Value
                // The "no-tenant" branch lets background jobs and anonymous endpoints see rows
                // irrespective of tenant when the accessor returns null.
                var equalsTenant = Expression.Equal(tenantProp, tenantValue);
                body = Expression.OrElse(Expression.Not(hasValue), equalsTenant);
            }

            if (isSoftDeletable)
            {
                var deletedProp = Expression.Property(parameter, nameof(ISoftDeletable.IsDeleted));
                var notDeleted = Expression.Equal(deletedProp, Expression.Constant(false));
                body = body is null ? notDeleted : Expression.AndAlso(body, notDeleted);
            }

            if (body is null)
            {
                continue;
            }

            var lambda = Expression.Lambda(body, parameter);
            modelBuilder.Entity(clrType).HasQueryFilter(lambda);
        }

        return modelBuilder;
    }
}
