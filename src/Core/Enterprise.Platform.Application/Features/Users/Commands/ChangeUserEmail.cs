using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Shared.Results;
using FluentValidation;

namespace Enterprise.Platform.Application.Features.Users.Commands;

/// <summary>
/// Replaces the user's canonical email. Conflict (<see cref="Result.Failure(Error)"/>)
/// when another user already owns the new address.
/// </summary>
public sealed record ChangeUserEmailCommand(Guid UserId, string NewEmail)
    : ICommand<Result>, IRequiresAudit, ICacheRegionInvalidating, IIdempotent
{
    /// <inheritdoc />
    public string AuditAction => "ChangeUserEmail";

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

/// <summary>FluentValidation rules for <see cref="ChangeUserEmailCommand"/>.</summary>
public sealed class ChangeUserEmailValidator : AbstractValidator<ChangeUserEmailCommand>
{
    /// <summary>Initialises the validator.</summary>
    public ChangeUserEmailValidator()
    {
        RuleFor(c => c.UserId).NotEmpty();
        RuleFor(c => c.NewEmail).NotEmpty().EmailAddress().MaximumLength(254);
    }
}

/// <summary>Handler for <see cref="ChangeUserEmailCommand"/>.</summary>
public sealed class ChangeUserEmailHandler(IUserRepository repository) : ICommandHandler<ChangeUserEmailCommand, Result>
{
    private readonly IUserRepository _repository = repository ?? throw new ArgumentNullException(nameof(repository));

    /// <inheritdoc />
    public Task<Result> HandleAsync(ChangeUserEmailCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);
        return _repository.ChangeEmailAsync(command.UserId, command.NewEmail, cancellationToken);
    }
}
