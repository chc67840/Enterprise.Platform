namespace Enterprise.Platform.Application.Abstractions.Messaging;

/// <summary>
/// Single entry point for commands and queries. The Api / Worker hosts resolve
/// <see cref="IDispatcher"/> and forward requests — they never inject handlers
/// directly. This abstraction hides the pipeline composition and the handler
/// resolution mechanism (currently reflection-based; optimization is internal).
/// </summary>
public interface IDispatcher
{
    /// <summary>Sends a command that returns no payload.</summary>
    Task SendAsync(ICommand command, CancellationToken cancellationToken = default);

    /// <summary>Sends a command that returns <typeparamref name="TResult"/>.</summary>
    Task<TResult> SendAsync<TResult>(ICommand<TResult> command, CancellationToken cancellationToken = default);

    /// <summary>Executes a query and returns its result.</summary>
    Task<TResult> QueryAsync<TResult>(IQuery<TResult> query, CancellationToken cancellationToken = default);
}
