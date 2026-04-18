namespace Enterprise.Platform.Application.Abstractions.Messaging;

/// <summary>
/// Handles a command that does not return a payload.
/// </summary>
/// <typeparam name="TCommand">Concrete command type.</typeparam>
public interface ICommandHandler<in TCommand>
    where TCommand : ICommand
{
    /// <summary>Executes <paramref name="command"/>. Throws for unrecoverable failures; prefer returning via <c>Result</c> for expected failures.</summary>
    Task HandleAsync(TCommand command, CancellationToken cancellationToken = default);
}

/// <summary>
/// Handles a command that returns <typeparamref name="TResult"/>.
/// </summary>
/// <typeparam name="TCommand">Concrete command type.</typeparam>
/// <typeparam name="TResult">Payload returned to the caller.</typeparam>
public interface ICommandHandler<in TCommand, TResult>
    where TCommand : ICommand<TResult>
{
    /// <summary>Executes <paramref name="command"/> and returns the result payload.</summary>
    Task<TResult> HandleAsync(TCommand command, CancellationToken cancellationToken = default);
}
