using Enterprise.Platform.Application.Common.Models;
using Enterprise.Platform.Contracts.DTOs.App;
using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Application.Abstractions.Persistence;

/// <summary>
/// Per-aggregate persistence contract for the <c>User</c> entity. Exposes both
/// reads (DTO-returning, AsNoTracking inside) and writes (string-/Guid-typed
/// inputs; the implementation owns the entity instance lifecycle). Handlers
/// inject this interface so they never see the EF entity, EF Core types, or the
/// <see cref="Enterprise.Platform.Contracts.Abstractions.Mapping.IMapper"/>
/// — that's all repository-internal.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why repos return DTOs in db-first.</b> The scaffolded entity lives in
/// <c>Enterprise.Platform.Infrastructure.Persistence.App.Entities</c> — the
/// Application layer can't reference it (Clean-Arch dependency direction).
/// Repository implementations bridge: load entity, mutate via behavior methods
/// on the partial, project to DTO via the generated mapper, return DTO.
/// </para>
/// <para>
/// <b>No SaveChangesAsync inside.</b> All mutations stage operations against the
/// change-tracker; <c>TransactionBehavior</c> in the MediatR pipeline owns the
/// flush. Calling <c>SaveChangesAsync</c> from inside any method here would break
/// the cross-aggregate transactional guarantee.
/// </para>
/// </remarks>
public interface IUserRepository
{
    // ── reads ───────────────────────────────────────────────────────────────

    /// <summary>Returns the user with <paramref name="id"/>, or <c>null</c> when not found.</summary>
    Task<UserDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Returns the user whose canonical (lower-cased) email matches, or <c>null</c>.</summary>
    Task<UserDto?> GetByEmailAsync(string email, CancellationToken cancellationToken);

    /// <summary>Returns the user linked to the given external IdP subject id, or <c>null</c>.</summary>
    Task<UserDto?> GetByExternalIdentityAsync(Guid externalIdentityId, CancellationToken cancellationToken);

    /// <summary>Cheap pre-flight check used by <see cref="RegisterAsync"/> handler before insert.</summary>
    Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken);

    /// <summary>
    /// Returns a paged slice of users with optional case-insensitive search across
    /// email + display name and an active-only filter.
    /// </summary>
    Task<PagedResult<UserDto>> ListAsync(
        int page,
        int pageSize,
        string? search,
        bool? activeOnly,
        CancellationToken cancellationToken);

    // ── writes ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Stages a new user for insert. Returns the projected DTO so the caller can
    /// emit a Location header / response body without a re-read round-trip.
    /// </summary>
    Task<Result<UserDto>> RegisterAsync(
        string email,
        string firstName,
        string lastName,
        Guid? externalIdentityId,
        CancellationToken cancellationToken);

    /// <summary>Replaces the user's first / last name. No-op when both parts already match.</summary>
    Task<Result> RenameAsync(Guid userId, string firstName, string lastName, CancellationToken cancellationToken);

    /// <summary>Replaces the user's canonical email. No-op when the new value already matches.</summary>
    Task<Result> ChangeEmailAsync(Guid userId, string newEmail, CancellationToken cancellationToken);

    /// <summary>Reactivates a deactivated user. <see cref="Result.Failure(Error)"/> when already active.</summary>
    Task<Result> ActivateAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>Deactivates an active user. <see cref="Result.Failure(Error)"/> when already inactive.</summary>
    Task<Result> DeactivateAsync(Guid userId, string reason, CancellationToken cancellationToken);
}
