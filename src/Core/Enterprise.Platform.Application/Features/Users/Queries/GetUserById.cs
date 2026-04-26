using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Contracts.DTOs.App;
using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Application.Features.Users.Queries;

/// <summary>Returns a single user by id, or a 404-shaped failure when no match.</summary>
public sealed record GetUserByIdQuery(Guid UserId) : IQuery<Result<UserDto>>, ICacheable
{
    /// <inheritdoc />
    public string CacheKey => $"users:byid:{UserId:N}";

    /// <inheritdoc />
    public TimeSpan? Ttl => TimeSpan.FromMinutes(5);
}

/// <summary>Handler for <see cref="GetUserByIdQuery"/>.</summary>
public sealed class GetUserByIdHandler(IUserRepository repository) : IQueryHandler<GetUserByIdQuery, Result<UserDto>>
{
    private readonly IUserRepository _repository = repository ?? throw new ArgumentNullException(nameof(repository));

    /// <inheritdoc />
    public async Task<Result<UserDto>> HandleAsync(GetUserByIdQuery query, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(query);

        var dto = await _repository.GetByIdAsync(query.UserId, cancellationToken).ConfigureAwait(false);
        return dto is null
            ? Result.Failure<UserDto>(Error.NotFound($"User {query.UserId} not found."))
            : Result.Success(dto);
    }
}
