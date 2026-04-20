using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Common.Models;
using Enterprise.Platform.Application.Features.EventShopper.Roles.Repositories;
using Enterprise.Platform.Contracts.DTOs.EventShopper;
using Enterprise.Platform.Shared.Constants;
using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Application.Features.EventShopper.Roles.Queries;

/// <summary>
/// Lists Roles with optional name substring filter + offset paging. Cached via
/// <see cref="ICacheable"/> so identical requests short-circuit the DB.
/// </summary>
public sealed record ListRolesQuery(
    string? NameContains = null,
    int PageNumber = 1,
    int PageSize = AppConstants.Paging.DefaultPageSize)
    : IQuery<Result<PagedResult<RolesDto>>>, ICacheable
{
    /// <inheritdoc />
    public string CacheKey => $"roles:list:{NameContains ?? "*"}:{Math.Max(1, PageNumber)}:{Math.Clamp(PageSize, 1, AppConstants.Paging.MaxPageSize)}";

    /// <inheritdoc />
    public string? CacheRegion => "roles";
}

/// <summary>Handler for <see cref="ListRolesQuery"/>.</summary>
public sealed class ListRolesHandler(IRolesRepository repository)
    : IQueryHandler<ListRolesQuery, Result<PagedResult<RolesDto>>>
{
    private readonly IRolesRepository _repository = repository ?? throw new ArgumentNullException(nameof(repository));

    /// <inheritdoc />
    public async Task<Result<PagedResult<RolesDto>>> HandleAsync(ListRolesQuery query, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(query);

        var pageNumber = Math.Max(1, query.PageNumber);
        var pageSize = Math.Clamp(query.PageSize, 1, AppConstants.Paging.MaxPageSize);
        var skip = (pageNumber - 1) * pageSize;

        var items = await _repository.ListAsync(query.NameContains, skip, pageSize, cancellationToken).ConfigureAwait(false);
        var total = await _repository.CountAsync(query.NameContains, cancellationToken).ConfigureAwait(false);

        return new PagedResult<RolesDto>
        {
            Items = items,
            PageNumber = pageNumber,
            PageSize = pageSize,
            TotalCount = total,
        };
    }
}
