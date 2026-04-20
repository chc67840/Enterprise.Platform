using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Features.EventShopper.Roles.Repositories;
using Enterprise.Platform.Shared.Constants;
using Enterprise.Platform.Shared.Results;
using FluentValidation;

namespace Enterprise.Platform.Application.Features.EventShopper.Roles.Commands;

/// <summary>
/// Creates a Role. Tagged with <see cref="ITransactional"/> (Phase-4 behavior wraps
/// in a transaction) and <see cref="IRequiresAudit"/> so the command emits an audit
/// entry through <c>AuditBehavior</c> (currently the null writer until PlatformDb
/// lands).
/// </summary>
public sealed record CreateRoleCommand(
    string Name,
    string Description,
    int Priority,
    bool IsActive)
    : ICommand<Result<int>>, ITransactional, IRequiresAudit
{
    /// <inheritdoc />
    public string AuditAction => "CreateRole";
}

/// <summary>FluentValidation rules for <see cref="CreateRoleCommand"/>.</summary>
public sealed class CreateRoleValidator : AbstractValidator<CreateRoleCommand>
{
    /// <summary>Initializes the ruleset.</summary>
    public CreateRoleValidator()
    {
        RuleFor(c => c.Name)
            .NotEmpty()
            .MaximumLength(AppConstants.StringLengths.Name);

        RuleFor(c => c.Description)
            .NotNull()
            .MaximumLength(AppConstants.StringLengths.Description);

        RuleFor(c => c.Priority)
            .InclusiveBetween(0, 1000);
    }
}

/// <summary>Handler for <see cref="CreateRoleCommand"/>.</summary>
public sealed class CreateRoleHandler(IRolesRepository repository)
    : ICommandHandler<CreateRoleCommand, Result<int>>
{
    private readonly IRolesRepository _repository = repository ?? throw new ArgumentNullException(nameof(repository));

    /// <inheritdoc />
    public async Task<Result<int>> HandleAsync(CreateRoleCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (await _repository.NameExistsAsync(command.Name, excludeId: null, cancellationToken).ConfigureAwait(false))
        {
            return Error.Conflict($"Role '{command.Name}' already exists.");
        }

        var id = await _repository.CreateAsync(
            new CreateRoleInput(command.Name, command.Description, command.Priority, command.IsActive),
            cancellationToken).ConfigureAwait(false);

        return id;
    }
}
