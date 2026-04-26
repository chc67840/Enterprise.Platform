using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Application.Common.Models;
using Enterprise.Platform.Contracts.DTOs.App;
using FluentValidation;

namespace Enterprise.Platform.Application.Features.Users.Queries;

/// <summary>
/// Page of <see cref="UserDto"/> for the list view. Includes optional case-insensitive
/// search across email + display name, an active-only filter, and offset paging.
/// </summary>
public sealed record ListUsersQuery(
    int Page = 1,
    int PageSize = 25,
    string? Search = null,
    bool? ActiveOnly = null) : IQuery<PagedResult<UserDto>>, ICacheable
{
    /// <inheritdoc />
    /// <remarks>
    /// Cache key encodes every query input so distinct filter combinations don't
    /// collide. The <c>users</c> region wipe (any <see cref="ICacheRegionInvalidating"/>
    /// command targeting <c>users</c>) drops every key under this prefix at once.
    /// </remarks>
    public string CacheKey => $"users:list:p={Page}:s={PageSize}:q={Search ?? "*"}:active={ActiveOnly?.ToString() ?? "*"}";

    /// <inheritdoc />
    public TimeSpan? Ttl => TimeSpan.FromMinutes(2);
}

/// <summary>FluentValidation rules for <see cref="ListUsersQuery"/>.</summary>
public sealed class ListUsersValidator : AbstractValidator<ListUsersQuery>
{
    /// <summary>Initialises the validator.</summary>
    public ListUsersValidator()
    {
        RuleFor(q => q.Page).GreaterThanOrEqualTo(1);
        RuleFor(q => q.PageSize).InclusiveBetween(1, 200);
        RuleFor(q => q.Search!).MaximumLength(100).When(q => q.Search is not null);
    }
}

/// <summary>Handler for <see cref="ListUsersQuery"/>.</summary>
public sealed class ListUsersHandler(IUserRepository repository) : IQueryHandler<ListUsersQuery, PagedResult<UserDto>>
{
    private readonly IUserRepository _repository = repository ?? throw new ArgumentNullException(nameof(repository));

    /// <inheritdoc />
    public Task<PagedResult<UserDto>> HandleAsync(ListUsersQuery query, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(query);
        return _repository.ListAsync(
            query.Page,
            query.PageSize,
            query.Search,
            query.ActiveOnly,
            cancellationToken);
    }
}
