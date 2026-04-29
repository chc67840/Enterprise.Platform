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
    /// <remarks>
    /// <para>
    /// <b>Pre-flight uniqueness check.</b> Mirrors the
    /// <see cref="CreateUserHandler"/> pattern — looks up the email and rejects
    /// when it's already owned by a *different* user. When the same address is
    /// re-submitted (e.g. accidental save), the lookup matches the target user
    /// and we fall through to the domain method, which is itself idempotent for
    /// same-email writes (see <c>User.ChangeEmail</c>).
    /// </para>
    /// <para>
    /// <b>Race-window contract.</b> Between this lookup and the
    /// <c>SaveChangesAsync</c> commit owned by <c>TransactionBehavior</c>,
    /// another transaction could grab the same email. The DB's unique index on
    /// <c>User.Email</c> remains the ultimate source of truth; an index
    /// violation in the race window bubbles as 409 via
    /// <c>GlobalExceptionMiddleware</c>. This pre-flight exists so the *common*
    /// case surfaces a friendly conflict before EF flushes.
    /// </para>
    /// </remarks>
    public async Task<Result> HandleAsync(ChangeUserEmailCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var canonicalEmail = command.NewEmail.Trim().ToLowerInvariant();

        var existing = await _repository.GetByEmailAsync(canonicalEmail, cancellationToken).ConfigureAwait(false);
        if (existing is not null && existing.Id != command.UserId)
        {
            return Result.Failure(
                Error.Conflict($"A user with email '{canonicalEmail}' already exists."));
        }

        return await _repository.ChangeEmailAsync(command.UserId, command.NewEmail, cancellationToken).ConfigureAwait(false);
    }
}
