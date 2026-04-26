using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Shared.Results;
using FluentValidation;

namespace Enterprise.Platform.Application.Features.Users.Commands;

/// <summary>
/// Deactivates an active user (reversible). Reason is captured on the
/// resulting <c>UserDeactivated</c> domain event for audit + downstream
/// notification consumers.
/// </summary>
public sealed record DeactivateUserCommand(Guid UserId, string Reason)
    : ICommand<Result>, IRequiresAudit, ICacheRegionInvalidating, IIdempotent
{
    /// <inheritdoc />
    public string AuditAction => "DeactivateUser";

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

/// <summary>FluentValidation rules for <see cref="DeactivateUserCommand"/>.</summary>
public sealed class DeactivateUserValidator : AbstractValidator<DeactivateUserCommand>
{
    /// <summary>Initialises the validator.</summary>
    public DeactivateUserValidator()
    {
        RuleFor(c => c.UserId).NotEmpty();
        RuleFor(c => c.Reason).NotEmpty().MaximumLength(500);
    }
}

/// <summary>Handler for <see cref="DeactivateUserCommand"/>.</summary>
public sealed class DeactivateUserHandler(IUserRepository repository) : ICommandHandler<DeactivateUserCommand, Result>
{
    private readonly IUserRepository _repository = repository ?? throw new ArgumentNullException(nameof(repository));

    /// <inheritdoc />
    public Task<Result> HandleAsync(DeactivateUserCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);
        return _repository.DeactivateAsync(command.UserId, command.Reason, cancellationToken);
    }
}
