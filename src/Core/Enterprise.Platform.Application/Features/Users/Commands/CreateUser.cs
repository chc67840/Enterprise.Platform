using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Contracts.DTOs.App;
using Enterprise.Platform.Shared.Results;
using FluentValidation;

namespace Enterprise.Platform.Application.Features.Users.Commands;

/// <summary>
/// Registers a new platform user. Returns <see cref="UserDto"/> on success or a
/// <see cref="Result.Failure(Error)"/> carrying the validation / conflict error.
/// </summary>
/// <remarks>
/// Pipeline behaviors active on this command (resolved by marker interfaces):
/// Logging → Validation → Audit (<see cref="IRequiresAudit"/>) →
/// CacheInvalidation (<see cref="ICacheRegionInvalidating"/>) → Transaction →
/// Idempotency (<see cref="IIdempotent"/>).
/// </remarks>
public sealed record CreateUserCommand(
    string Email,
    string FirstName,
    string LastName,
    Guid? ExternalIdentityId)
    : ICommand<Result<UserDto>>, IRequiresAudit, ICacheRegionInvalidating, IIdempotent
{
    /// <inheritdoc />
    public string AuditAction => "CreateUser";

    /// <inheritdoc />
    public string? AuditSubject => Email.ToLowerInvariant();

    /// <inheritdoc />
    public IEnumerable<string> CacheRegionsToInvalidate()
    {
        yield return "users";
    }

    /// <inheritdoc />
    public string IdempotencyKey { get; init; } = string.Empty;
}

/// <summary>FluentValidation rules for <see cref="CreateUserCommand"/>.</summary>
public sealed class CreateUserValidator : AbstractValidator<CreateUserCommand>
{
    /// <summary>Initialises the validator with input-shape constraints.</summary>
    public CreateUserValidator()
    {
        RuleFor(c => c.Email).NotEmpty().EmailAddress().MaximumLength(254);
        RuleFor(c => c.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(c => c.LastName).NotEmpty().MaximumLength(100);
    }
}

/// <summary>Handler for <see cref="CreateUserCommand"/>.</summary>
public sealed class CreateUserHandler(IUserRepository repository) : ICommandHandler<CreateUserCommand, Result<UserDto>>
{
    private readonly IUserRepository _repository = repository ?? throw new ArgumentNullException(nameof(repository));

    /// <inheritdoc />
    public async Task<Result<UserDto>> HandleAsync(CreateUserCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        // Pre-flight uniqueness check — surfaces a friendly conflict error before
        // SaveChanges hits the unique-index. The DB index is the ultimate source
        // of truth (race-window between this check and the commit); in that
        // window the unique-index throw bubbles as a 409 via GlobalExceptionMiddleware.
        var canonicalEmail = command.Email.Trim().ToLowerInvariant();
        if (await _repository.EmailExistsAsync(canonicalEmail, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<UserDto>(
                Error.Conflict($"A user with email '{canonicalEmail}' already exists."));
        }

        return await _repository.RegisterAsync(
            command.Email,
            command.FirstName,
            command.LastName,
            command.ExternalIdentityId,
            cancellationToken).ConfigureAwait(false);
    }
}
