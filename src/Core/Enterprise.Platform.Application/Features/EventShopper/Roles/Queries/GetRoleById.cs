using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Features.EventShopper.Roles.Repositories;
using Enterprise.Platform.Contracts.DTOs.EventShopper;
using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Application.Features.EventShopper.Roles.Queries;

/// <summary>Fetches a single Role by its integer identity.</summary>
public sealed record GetRoleByIdQuery(int Id) : IQuery<Result<RolesDto>>, ICacheable
{
    /// <inheritdoc />
    public string CacheKey => $"roles:byid:{Id}";

    /// <inheritdoc />
    public string? CacheRegion => "roles";
}

/// <summary>Handler for <see cref="GetRoleByIdQuery"/>.</summary>
public sealed class GetRoleByIdHandler(IRolesRepository repository)
    : IQueryHandler<GetRoleByIdQuery, Result<RolesDto>>
{
    private readonly IRolesRepository _repository = repository ?? throw new ArgumentNullException(nameof(repository));

    /// <inheritdoc />
    public async Task<Result<RolesDto>> HandleAsync(GetRoleByIdQuery query, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(query);

        var role = await _repository.GetByIdAsync(query.Id, cancellationToken).ConfigureAwait(false);
        return role is null
            ? Error.NotFound($"Role with id '{query.Id}' was not found.")
            : role;
    }
}
