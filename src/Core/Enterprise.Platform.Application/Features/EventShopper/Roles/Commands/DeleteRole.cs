using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Features.EventShopper.Roles.Repositories;
using Enterprise.Platform.Shared.Results;
using FluentValidation;

namespace Enterprise.Platform.Application.Features.EventShopper.Roles.Commands;

/// <summary>Soft-deletes a Role (the scaffolded table carries <c>DeletedAt</c>/<c>DeletedBy</c> columns).</summary>
public sealed record DeleteRoleCommand(int Id, byte[] RowVersion)
    : ICommand<Result>, ITransactional, IRequiresAudit
{
    /// <inheritdoc />
    public string AuditAction => "DeleteRole";

    /// <inheritdoc />
    public string? AuditSubject => Id.ToString(System.Globalization.CultureInfo.InvariantCulture);
}

/// <summary>FluentValidation rules for <see cref="DeleteRoleCommand"/>.</summary>
public sealed class DeleteRoleValidator : AbstractValidator<DeleteRoleCommand>
{
    /// <summary>Initializes the ruleset.</summary>
    public DeleteRoleValidator()
    {
        RuleFor(c => c.Id).GreaterThan(0);
        RuleFor(c => c.RowVersion).NotNull().NotEmpty();
    }
}

/// <summary>Handler for <see cref="DeleteRoleCommand"/>.</summary>
public sealed class DeleteRoleHandler(IRolesRepository repository)
    : ICommandHandler<DeleteRoleCommand, Result>
{
    private readonly IRolesRepository _repository = repository ?? throw new ArgumentNullException(nameof(repository));

    /// <inheritdoc />
    public async Task<Result> HandleAsync(DeleteRoleCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var ok = await _repository.DeleteAsync(command.Id, command.RowVersion, cancellationToken).ConfigureAwait(false);
        return ok
            ? Result.Success()
            : Result.Failure(Error.NotFound($"Role with id '{command.Id}' was not found."));
    }
}
