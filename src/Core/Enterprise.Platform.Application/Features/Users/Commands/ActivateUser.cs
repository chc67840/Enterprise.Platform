using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Shared.Results;
using FluentValidation;

namespace Enterprise.Platform.Application.Features.Users.Commands;

/// <summary>Reactivates a deactivated user.</summary>
public sealed record ActivateUserCommand(Guid UserId)
    : ICommand<Result>, IRequiresAudit, ICacheRegionInvalidating, IIdempotent
{
    /// <inheritdoc />
    public string AuditAction => "ActivateUser";

    /// <inheritdoc />
    public string? AuditSubject => UserId.ToString();

    /// <inheritdoc />
    public IEnumerable<string> CacheRegionsToInvalidate()
    {
        yield return "users";
        yield return $"users:byid:{UserId:N}";
    }

    /// <inheritdoc />
    public string IdempotencyKey { get; init; } = string.Empty;
}

/// <summary>FluentValidation rules for <see cref="ActivateUserCommand"/>.</summary>
public sealed class ActivateUserValidator : AbstractValidator<ActivateUserCommand>
{
    /// <summary>Initialises the validator.</summary>
    public ActivateUserValidator()
    {
        RuleFor(c => c.UserId).NotEmpty();
    }
}

/// <summary>Handler for <see cref="ActivateUserCommand"/>.</summary>
public sealed class ActivateUserHandler(IUserRepository repository) : ICommandHandler<ActivateUserCommand, Result>
{
    private readonly IUserRepository _repository = repository ?? throw new ArgumentNullException(nameof(repository));

    /// <inheritdoc />
    public Task<Result> HandleAsync(ActivateUserCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);
        return _repository.ActivateAsync(command.UserId, cancellationToken);
    }
}
