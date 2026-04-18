using System.Diagnostics.CodeAnalysis;

namespace Enterprise.Platform.Application.Abstractions.Messaging;

/// <summary>
/// Marker for a command — a request that mutates state and may or may not return a
/// value. Paired with <see cref="ICommandHandler{TCommand}"/> by the dispatcher. See
/// <see cref="ICommand{TResult}"/> for the result-carrying variant.
/// </summary>
[SuppressMessage("Design", "CA1040:Avoid empty interfaces", Justification = "Marker interface that types commands for dispatcher routing.")]
public interface ICommand
{
}

/// <summary>
/// Marker for a command that returns <typeparamref name="TResult"/>. Convention: most
/// commands return <c>Result</c> or <c>Result&lt;T&gt;</c> from
/// <c>Enterprise.Platform.Shared.Results</c>.
/// </summary>
/// <typeparam name="TResult">Return payload.</typeparam>
[SuppressMessage("Design", "CA1040:Avoid empty interfaces", Justification = "Marker interface that types commands for dispatcher routing.")]
public interface ICommand<TResult>
{
}
