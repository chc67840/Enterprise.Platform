using Enterprise.Platform.Domain.Entities;
using Enterprise.Platform.Domain.Specifications;

namespace Enterprise.Platform.Domain.Interfaces;

/// <summary>
/// Persistence-agnostic repository contract for <b>code-first</b> aggregates inheriting
/// <see cref="BaseEntity"/>. Handlers depend on this interface — never on EF Core's
/// <c>DbSet</c> — so test doubles and alternate providers slot in cleanly. PlatformDb
/// aggregates (User / Role / Tenant / AuditLog / OutboxMessage, once the D4 deferral
/// lifts) are the target consumers.
/// </summary>
/// <remarks>
/// <para>
/// <b>Not applicable to DB-first scaffolded entities</b> like those in EventShopperDb —
/// they don't derive from <see cref="BaseEntity"/> and have integer (or other)
/// primary keys, not <see cref="Guid"/>. For DB-first aggregates, write a
/// <b>per-aggregate repository</b> like
/// <c>Application.Features.EventShopper.Roles.Repositories.IRolesRepository</c> — it
/// returns DTOs (never entities), exposes aggregate-specific reads, and lives in the
/// feature folder so the contract stays close to its handlers.
/// </para>
/// <para>
/// The open-generic DI registration (<c>services.AddScoped(typeof(IGenericRepository&lt;&gt;), typeof(GenericRepository&lt;&gt;))</c>)
/// is harmless for EventShopperDb entities — DI won't close the generic over types
/// that don't satisfy the <c>T : BaseEntity</c> constraint, so attempted resolution
/// fails fast with a clear compiler/runtime error.
/// </para>
/// </remarks>
/// <typeparam name="T">Aggregate or entity type inheriting <see cref="BaseEntity"/>.</typeparam>
public interface IGenericRepository<T> where T : BaseEntity
{
    /// <summary>Returns the entity with <paramref name="id"/>, or <c>null</c> if absent.</summary>
    Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Returns the single entity matching <paramref name="specification"/>, or <c>null</c>.</summary>
    Task<T?> GetSingleOrDefaultAsync(ISpecification<T> specification, CancellationToken cancellationToken = default);

    /// <summary>Returns all entities matching <paramref name="specification"/>.</summary>
    Task<IReadOnlyList<T>> ListAsync(ISpecification<T> specification, CancellationToken cancellationToken = default);

    /// <summary>Counts entities matching <paramref name="specification"/>. Respects the criteria but ignores paging.</summary>
    Task<int> CountAsync(ISpecification<T> specification, CancellationToken cancellationToken = default);

    /// <summary>Returns <c>true</c> when at least one entity matches <paramref name="specification"/>.</summary>
    Task<bool> AnyAsync(ISpecification<T> specification, CancellationToken cancellationToken = default);

    /// <summary>Stages <paramref name="entity"/> for insert on the next <c>SaveChanges</c>.</summary>
    Task AddAsync(T entity, CancellationToken cancellationToken = default);

    /// <summary>Stages a batch insert.</summary>
    Task AddRangeAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default);

    /// <summary>Marks <paramref name="entity"/> as updated.</summary>
    void Update(T entity);

    /// <summary>Marks <paramref name="entity"/> for removal. Soft-deletable entities are flagged, not dropped.</summary>
    void Remove(T entity);

    /// <summary>Removes a batch of entities.</summary>
    void RemoveRange(IEnumerable<T> entities);
}
