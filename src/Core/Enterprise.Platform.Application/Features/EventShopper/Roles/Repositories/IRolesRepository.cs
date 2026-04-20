using Enterprise.Platform.Contracts.DTOs.EventShopper;

namespace Enterprise.Platform.Application.Features.EventShopper.Roles.Repositories;

/// <summary>
/// Per-aggregate repository for the scaffolded <c>Roles</c> entity. Returns DTOs
/// (never entities) so Application handlers never see Infrastructure types.
/// Implements domain-level operations; EF's change-tracking and <c>SaveChanges</c>
/// are hidden inside the Infrastructure impl.
/// </summary>
/// <remarks>
/// DB-first scaffolded entities don't inherit from <c>BaseEntity</c>, so the Phase-5
/// open-generic <c>IGenericRepository&lt;T&gt;</c> (which requires <c>T : BaseEntity</c>)
/// isn't applicable. Per-aggregate repos are the right granularity here — they also
/// let us add aggregate-specific reads (<c>NameExistsAsync</c>) that don't belong
/// on a generic interface.
/// </remarks>
public interface IRolesRepository
{
    /// <summary>Returns a page of Roles matching the filter, ordered by Priority asc then Name asc.</summary>
    Task<IReadOnlyList<RolesDto>> ListAsync(string? nameContains, int skip, int take, CancellationToken cancellationToken = default);

    /// <summary>Counts Roles matching the filter.</summary>
    Task<int> CountAsync(string? nameContains, CancellationToken cancellationToken = default);

    /// <summary>Returns the Role with <paramref name="id"/>, or <c>null</c> when absent.</summary>
    Task<RolesDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Returns <c>true</c> when a Role with <paramref name="name"/> exists (optionally excluding <paramref name="excludeId"/> on updates).</summary>
    Task<bool> NameExistsAsync(string name, int? excludeId, CancellationToken cancellationToken = default);

    /// <summary>Creates a Role and returns its assigned identity (internal <c>SaveChanges</c>).</summary>
    Task<int> CreateAsync(CreateRoleInput input, CancellationToken cancellationToken = default);

    /// <summary>Updates a Role. Throws <c>ConcurrencyConflictException</c> when <paramref name="rowVersion"/> is stale.</summary>
    Task<bool> UpdateAsync(int id, UpdateRoleInput input, byte[] rowVersion, CancellationToken cancellationToken = default);

    /// <summary>Soft-deletes a Role by id (scaffolded table has <c>DeletedAt</c>/<c>DeletedBy</c>).</summary>
    Task<bool> DeleteAsync(int id, byte[] rowVersion, CancellationToken cancellationToken = default);
}

/// <summary>Create payload — keeps Infrastructure entity types out of Application signatures.</summary>
public sealed record CreateRoleInput(
    string Name,
    string Description,
    int Priority,
    bool IsActive);

/// <summary>Update payload — same shape as create, identity supplied separately.</summary>
public sealed record UpdateRoleInput(
    string Name,
    string Description,
    int Priority,
    bool IsActive);
