using Enterprise.Platform.Application.Features.EventShopper.Roles.Repositories;
using Enterprise.Platform.Contracts.DTOs.EventShopper;
using Enterprise.Platform.Domain.Exceptions;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper.Contexts;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;
using Mapster;
using MapsterMapper;
using Microsoft.EntityFrameworkCore;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Repositories;

/// <summary>
/// EF-backed <see cref="IRolesRepository"/>. Reads project to <see cref="RolesDto"/>
/// via Mapster + <c>AsNoTracking</c>; writes stage + <c>SaveChanges</c> internally so
/// handlers stay terse. <c>DbUpdateConcurrencyException</c> is translated to
/// <see cref="ConcurrencyConflictException"/> so it surfaces as a 409 through the
/// global exception middleware.
/// </summary>
public sealed class RolesRepository(EventShopperDbContext context, IMapper mapper) : IRolesRepository
{
    private readonly EventShopperDbContext _context = context ?? throw new ArgumentNullException(nameof(context));
    private readonly IMapper _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));

    /// <inheritdoc />
    public async Task<IReadOnlyList<RolesDto>> ListAsync(
        string? nameContains,
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        var query = BaseQuery(nameContains)
            .OrderBy(r => r.Priority)
            .ThenBy(r => r.Name)
            .Skip(skip)
            .Take(take);

        return await query
            .ProjectToType<RolesDto>(_mapper.Config)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public Task<int> CountAsync(string? nameContains, CancellationToken cancellationToken = default)
        => BaseQuery(nameContains).CountAsync(cancellationToken);

    /// <inheritdoc />
    public async Task<RolesDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var entity = await _context.Roles
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id && r.DeletedAt == null, cancellationToken)
            .ConfigureAwait(false);
        return entity is null ? null : _mapper.Map<RolesDto>(entity);
    }

    /// <inheritdoc />
    public Task<bool> NameExistsAsync(string name, int? excludeId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        var query = _context.Roles.AsNoTracking().Where(r => r.DeletedAt == null && r.Name == name);
        if (excludeId is { } id)
        {
            query = query.Where(r => r.Id != id);
        }

        return query.AnyAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<int> CreateAsync(CreateRoleInput input, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(input);

        var entity = new Roles
        {
            Name = input.Name,
            Description = input.Description,
            Priority = input.Priority,
            IsActive = input.IsActive,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        await _context.Roles.AddAsync(entity, cancellationToken).ConfigureAwait(false);
        await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return entity.Id;
    }

    /// <inheritdoc />
    public async Task<bool> UpdateAsync(
        int id,
        UpdateRoleInput input,
        byte[] rowVersion,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(input);
        ArgumentNullException.ThrowIfNull(rowVersion);

        var entity = await _context.Roles.FirstOrDefaultAsync(r => r.Id == id && r.DeletedAt == null, cancellationToken)
            .ConfigureAwait(false);
        if (entity is null)
        {
            return false;
        }

        _context.Entry(entity).Property(e => e.RowVersion).OriginalValue = rowVersion;

        entity.Name = input.Name;
        entity.Description = input.Description;
        entity.Priority = input.Priority;
        entity.IsActive = input.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyConflictException(nameof(Roles), id);
        }
    }

    /// <inheritdoc />
    public async Task<bool> DeleteAsync(int id, byte[] rowVersion, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(rowVersion);

        var entity = await _context.Roles.FirstOrDefaultAsync(r => r.Id == id && r.DeletedAt == null, cancellationToken)
            .ConfigureAwait(false);
        if (entity is null)
        {
            return false;
        }

        _context.Entry(entity).Property(e => e.RowVersion).OriginalValue = rowVersion;

        // Soft-delete: the scaffolded table carries DeletedAt/DeletedBy columns, so we
        // flip them directly. A future Roles domain promotion could add an
        // ISoftDeletable-backed entity + the Phase-5 SoftDeleteInterceptor would own this.
        entity.DeletedAt = DateTime.UtcNow;
        entity.IsActive = false;

        try
        {
            await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyConflictException(nameof(Roles), id);
        }
    }

    private IQueryable<Roles> BaseQuery(string? nameContains)
    {
        var query = _context.Roles.AsNoTracking().Where(r => r.DeletedAt == null);
        if (!string.IsNullOrWhiteSpace(nameContains))
        {
            query = query.Where(r => EF.Functions.Like(r.Name, $"%{nameContains}%"));
        }

        return query;
    }
}
