using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Shared.Results;
using FluentValidation;

namespace Enterprise.Platform.Application.Features.Users.Commands;

/// <summary>Replaces the user's first / last name. Idempotent at the domain level.</summary>
public sealed record RenameUserCommand(Guid UserId, string FirstName, string LastName)
    : ICommand<Result>, IRequiresAudit, ICacheRegionInvalidating, IIdempotent
{
    /// <inheritdoc />
    public string AuditAction => "RenameUser";

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

/// <summary>FluentValidation rules for <see cref="RenameUserCommand"/>.</summary>
public sealed class RenameUserValidator : AbstractValidator<RenameUserCommand>
{
    /// <summary>Initialises the validator.</summary>
    public RenameUserValidator()
    {
        RuleFor(c => c.UserId).NotEmpty();
        RuleFor(c => c.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(c => c.LastName).NotEmpty().MaximumLength(100);
    }
}

/// <summary>Handler for <see cref="RenameUserCommand"/>.</summary>
public sealed class RenameUserHandler(IUserRepository repository) : ICommandHandler<RenameUserCommand, Result>
{
    private readonly IUserRepository _repository = repository ?? throw new ArgumentNullException(nameof(repository));

    /// <inheritdoc />
    public Task<Result> HandleAsync(RenameUserCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);
        return _repository.RenameAsync(command.UserId, command.FirstName, command.LastName, cancellationToken);
    }
}
