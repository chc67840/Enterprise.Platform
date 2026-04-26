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
/// Paired with the write-side <c>SoftDeleteInterceptor</c>: writes are stamped,
/// reads are masked. Together they close the soft-delete invariant for
/// <see cref="ISoftDeletable"/> entities.
/// </remarks>
public static class ModelBuilderExtensions
{
    /// <summary>
    /// Iterates every registered entity type and applies a soft-delete filter
    /// (<c>e.IsDeleted == false</c>) when <see cref="ISoftDeletable"/> is implemented.
    /// </summary>
    /// <param name="modelBuilder">The EF model builder.</param>
    public static ModelBuilder ApplySoftDeleteFilter(this ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            var clrType = entityType.ClrType;
            if (!typeof(ISoftDeletable).IsAssignableFrom(clrType))
            {
                continue;
            }

            var parameter = Expression.Parameter(clrType, "e");
            var deletedProp = Expression.Property(parameter, nameof(ISoftDeletable.IsDeleted));
            var notDeleted = Expression.Equal(deletedProp, Expression.Constant(false));
            var lambda = Expression.Lambda(notDeleted, parameter);

            modelBuilder.Entity(clrType).HasQueryFilter(lambda);
        }

        return modelBuilder;
    }
}
