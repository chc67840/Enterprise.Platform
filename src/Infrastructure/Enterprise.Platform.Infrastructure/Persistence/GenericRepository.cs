using Enterprise.Platform.Domain.Entities;
using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Domain.Specifications;
using Microsoft.EntityFrameworkCore;

namespace Enterprise.Platform.Infrastructure.Persistence;

/// <summary>
/// EF Core-backed <see cref="IGenericRepository{T}"/> implementation. Works against
/// any <see cref="DbContext"/> that maps <typeparamref name="T"/>. Typical wiring in
/// single-context scenarios: <c>services.AddScoped(typeof(IGenericRepository&lt;&gt;),
/// typeof(GenericRepository&lt;&gt;));</c> alongside a scoped <see cref="DbContext"/>.
/// Multi-context scenarios register per-context (keyed) variants.
/// </summary>
/// <typeparam name="T">Aggregate root or entity.</typeparam>
public class GenericRepository<T> : IGenericRepository<T> where T : BaseEntity
{
    /// <summary>Underlying EF context. Exposed <c>protected</c> for derived repositories that need raw access.</summary>
    protected DbContext Context { get; }

    /// <summary>The typed set for <typeparamref name="T"/>.</summary>
    protected DbSet<T> Set => Context.Set<T>();

    /// <summary>Initializes the repository with the resolved <paramref name="context"/>.</summary>
    public GenericRepository(DbContext context)
    {
        Context = context ?? throw new ArgumentNullException(nameof(context));
    }

    /// <inheritdoc />
    public virtual async Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => await Set.FindAsync([id], cancellationToken).ConfigureAwait(false);

    /// <inheritdoc />
    public virtual async Task<T?> GetSingleOrDefaultAsync(
        ISpecification<T> specification,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(specification);
        return await ApplySpecification(specification)
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public virtual async Task<IReadOnlyList<T>> ListAsync(
        ISpecification<T> specification,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(specification);
        return await ApplySpecification(specification)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public virtual async Task<int> CountAsync(
        ISpecification<T> specification,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(specification);
        // Paging / sorting don't affect counts — apply criteria + includes only.
        var query = specification.Criteria is null
            ? Set.AsQueryable()
            : Set.Where(specification.Criteria);
        return await query.CountAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public virtual async Task<bool> AnyAsync(
        ISpecification<T> specification,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(specification);
        var query = specification.Criteria is null
            ? Set.AsQueryable()
            : Set.Where(specification.Criteria);
        return await query.AnyAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public virtual async Task AddAsync(T entity, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(entity);
        await Set.AddAsync(entity, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public virtual async Task AddRangeAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(entities);
        await Set.AddRangeAsync(entities, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public virtual void Update(T entity)
    {
        ArgumentNullException.ThrowIfNull(entity);
        Set.Update(entity);
    }

    /// <inheritdoc />
    public virtual void Remove(T entity)
    {
        ArgumentNullException.ThrowIfNull(entity);
        Set.Remove(entity);
    }

    /// <inheritdoc />
    public virtual void RemoveRange(IEnumerable<T> entities)
    {
        ArgumentNullException.ThrowIfNull(entities);
        Set.RemoveRange(entities);
    }

    /// <summary>Applies <paramref name="specification"/> to the set. Derived repositories may override to project or join.</summary>
    protected IQueryable<T> ApplySpecification(ISpecification<T> specification)
        => SpecificationEvaluator.Apply(Set.AsQueryable(), specification);
}
