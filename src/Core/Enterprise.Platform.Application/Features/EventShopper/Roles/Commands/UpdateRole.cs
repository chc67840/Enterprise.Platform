using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Features.EventShopper.Roles.Repositories;
using Enterprise.Platform.Shared.Constants;
using Enterprise.Platform.Shared.Results;
using FluentValidation;

namespace Enterprise.Platform.Application.Features.EventShopper.Roles.Commands;

/// <summary>
/// Updates a Role. <see cref="RowVersion"/> enforces optimistic concurrency —
/// a stale token surfaces as <c>ConcurrencyConflictException</c> via the
/// infrastructure translator.
/// </summary>
public sealed record UpdateRoleCommand(
    int Id,
    string Name,
    string Description,
    int Priority,
    bool IsActive,
    byte[] RowVersion)
    : ICommand<Result>, ITransactional, IRequiresAudit, ICacheInvalidating
{
    /// <inheritdoc />
    public string AuditAction => "UpdateRole";

    /// <inheritdoc />
    public string? AuditSubject => Id.ToString(System.Globalization.CultureInfo.InvariantCulture);

    /// <inheritdoc />
    public IEnumerable<string> CacheKeysToInvalidate()
    {
        yield return $"roles:byid:{Id}";
        // List-variant keys are TTL-scoped (5m default). Invalidating every
        // filter/page combination would require enumeration — a version-key pattern
        // can layer in later when list-cache churn matters.
    }
}

/// <summary>FluentValidation rules for <see cref="UpdateRoleCommand"/>.</summary>
public sealed class UpdateRoleValidator : AbstractValidator<UpdateRoleCommand>
{
    /// <summary>Initializes the ruleset.</summary>
    public UpdateRoleValidator()
    {
        RuleFor(c => c.Id).GreaterThan(0);
        RuleFor(c => c.Name).NotEmpty().MaximumLength(AppConstants.StringLengths.Name);
        RuleFor(c => c.Description).NotNull().MaximumLength(AppConstants.StringLengths.Description);
        RuleFor(c => c.Priority).InclusiveBetween(0, 1000);
        RuleFor(c => c.RowVersion).NotNull().NotEmpty();
    }
}

/// <summary>Handler for <see cref="UpdateRoleCommand"/>.</summary>
public sealed class UpdateRoleHandler(IRolesRepository repository)
    : ICommandHandler<UpdateRoleCommand, Result>
{
    private readonly IRolesRepository _repository = repository ?? throw new ArgumentNullException(nameof(repository));

    /// <inheritdoc />
    public async Task<Result> HandleAsync(UpdateRoleCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (await _repository.NameExistsAsync(command.Name, excludeId: command.Id, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(Error.Conflict($"Role '{command.Name}' already exists on a different record."));
        }

        var ok = await _repository.UpdateAsync(
            command.Id,
            new UpdateRoleInput(command.Name, command.Description, command.Priority, command.IsActive),
            command.RowVersion,
            cancellationToken).ConfigureAwait(false);

        return ok
            ? Result.Success()
            : Result.Failure(Error.NotFound($"Role with id '{command.Id}' was not found."));
    }
}
