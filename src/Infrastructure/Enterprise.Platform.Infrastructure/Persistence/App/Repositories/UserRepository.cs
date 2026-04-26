using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Application.Common.Interfaces;
using Enterprise.Platform.Application.Common.Models;
using Enterprise.Platform.Contracts.DTOs.App;
using Enterprise.Platform.Domain.Exceptions;
using Enterprise.Platform.Infrastructure.Persistence.App.Contexts;
using Enterprise.Platform.Infrastructure.Persistence.App.Entities;
using Enterprise.Platform.Infrastructure.Persistence.App.Mappings;
using Enterprise.Platform.Shared.Results;
using Microsoft.EntityFrameworkCore;

namespace Enterprise.Platform.Infrastructure.Persistence.App.Repositories;

/// <summary>
/// EF Core implementation of <see cref="IUserRepository"/>. Reads use
/// <c>AsNoTracking</c>; writes load the entity into the change-tracker so
/// behavior methods on the partial (<c>User.Behavior.cs</c>) can mutate state +
/// raise domain events. Mapping to DTO uses the generated
/// <see cref="UserMappers.ToDto"/> extension — no reflection on the hot path.
/// </summary>
/// <remarks>
/// <para>
/// <b>P0-2 audit compliance.</b> Methods on this class deliberately do NOT
/// call <c>SaveChangesAsync</c>. The handler that invokes them is wrapped by
/// <c>TransactionBehavior</c> in the MediatR pipeline; that behavior owns the
/// unit-of-work flush and decides when to commit.
/// </para>
/// <para>
/// <b>Why behavior on the entity, not in the repo.</b> The entity is a
/// partial spread across <c>User.cs</c> (scaffold) and <c>User.Behavior.cs</c>
/// (hand-authored). The behavior file owns the mutation methods so business
/// invariants live with the entity (DDD-friendly) and surviving re-scaffold is
/// trivial — only the scaffolded property file gets overwritten.
/// </para>
/// </remarks>
public sealed class UserRepository(AppDbContext context, IDateTimeProvider dateTime) : IUserRepository
{
    private readonly AppDbContext _context = context ?? throw new ArgumentNullException(nameof(context));
    private readonly IDateTimeProvider _dateTime = dateTime ?? throw new ArgumentNullException(nameof(dateTime));

    // ── reads ───────────────────────────────────────────────────────────────

    /// <inheritdoc />
    public async Task<UserDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var user = await _context.User.AsNoTracking()
            .SingleOrDefaultAsync(u => u.Id == id, cancellationToken).ConfigureAwait(false);
        return user?.ToDto();
    }

    /// <inheritdoc />
    public async Task<UserDto?> GetByEmailAsync(string email, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        var canonical = email.Trim().ToLowerInvariant();
        var user = await _context.User.AsNoTracking()
            .SingleOrDefaultAsync(u => u.Email == canonical, cancellationToken).ConfigureAwait(false);
        return user?.ToDto();
    }

    /// <inheritdoc />
    public async Task<UserDto?> GetByExternalIdentityAsync(Guid externalIdentityId, CancellationToken cancellationToken)
    {
        var user = await _context.User.AsNoTracking()
            .SingleOrDefaultAsync(u => u.ExternalIdentityId == externalIdentityId, cancellationToken).ConfigureAwait(false);
        return user?.ToDto();
    }

    /// <inheritdoc />
    public Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        var canonical = email.Trim().ToLowerInvariant();
        return _context.User.AsNoTracking().AnyAsync(u => u.Email == canonical, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<PagedResult<UserDto>> ListAsync(
        int page,
        int pageSize,
        string? search,
        bool? activeOnly,
        CancellationToken cancellationToken)
    {
        var filtered = _context.User.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            // Email is stored lower-cased on write so a literal LIKE is already
            // case-insensitive there. For the name, SQL Server's default CI_AS
            // collation makes LIKE case-insensitive too — no ToLower needed.
            var pattern = $"%{search.Trim()}%";
            filtered = filtered.Where(u =>
                EF.Functions.Like(u.Email, pattern)
                || EF.Functions.Like(u.FirstName + " " + u.LastName, pattern));
        }

        if (activeOnly.HasValue)
        {
            var wantActive = activeOnly.Value;
            filtered = filtered.Where(u => u.IsActive == wantActive);
        }

        // One round-trip for the count, one for the page. EF Core's split-query
        // optimisation wouldn't help here (no joins) — two simple selects beat a
        // window-function trick at small page sizes.
        var total = await filtered.CountAsync(cancellationToken).ConfigureAwait(false);

        var items = await filtered
            .OrderBy(u => u.LastName)
            .ThenBy(u => u.FirstName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new PagedResult<UserDto>
        {
            Items = items.ConvertAll(u => u.ToDto()),
            PageNumber = page,
            PageSize = pageSize,
            TotalCount = total,
        };
    }

    // ── writes ──────────────────────────────────────────────────────────────

    /// <inheritdoc />
    public async Task<Result<UserDto>> RegisterAsync(
        string email,
        string firstName,
        string lastName,
        Guid? externalIdentityId,
        CancellationToken cancellationToken)
    {
        var user = User.Register(email, firstName, lastName, _dateTime.UtcNow, externalIdentityId);
        await _context.User.AddAsync(user, cancellationToken).ConfigureAwait(false);
        return Result.Success(user.ToDto());
    }

    /// <inheritdoc />
    public async Task<Result> RenameAsync(Guid userId, string firstName, string lastName, CancellationToken cancellationToken)
    {
        var user = await _context.User.SingleOrDefaultAsync(u => u.Id == userId, cancellationToken).ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure(Error.NotFound($"User {userId} not found."));
        }
        user.Rename(firstName, lastName, _dateTime.UtcNow);
        return Result.Success();
    }

    /// <inheritdoc />
    public async Task<Result> ChangeEmailAsync(Guid userId, string newEmail, CancellationToken cancellationToken)
    {
        var user = await _context.User.SingleOrDefaultAsync(u => u.Id == userId, cancellationToken).ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure(Error.NotFound($"User {userId} not found."));
        }
        user.ChangeEmail(newEmail, _dateTime.UtcNow);
        return Result.Success();
    }

    /// <inheritdoc />
    public async Task<Result> ActivateAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await _context.User.SingleOrDefaultAsync(u => u.Id == userId, cancellationToken).ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure(Error.NotFound($"User {userId} not found."));
        }

        try
        {
            user.Activate(_dateTime.UtcNow);
            return Result.Success();
        }
        catch (BusinessRuleViolationException ex)
        {
            return Result.Failure(Error.Conflict(ex.Message));
        }
    }

    /// <inheritdoc />
    public async Task<Result> DeactivateAsync(Guid userId, string reason, CancellationToken cancellationToken)
    {
        var user = await _context.User.SingleOrDefaultAsync(u => u.Id == userId, cancellationToken).ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure(Error.NotFound($"User {userId} not found."));
        }

        try
        {
            user.Deactivate(reason, _dateTime.UtcNow);
            return Result.Success();
        }
        catch (BusinessRuleViolationException ex)
        {
            return Result.Failure(Error.Conflict(ex.Message));
        }
    }
}
