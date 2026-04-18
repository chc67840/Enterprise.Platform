using System.Reflection;
using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Microsoft.Extensions.DependencyInjection;

namespace Enterprise.Platform.Application.Dispatcher;

/// <summary>
/// Default <see cref="IDispatcher"/> implementation. Resolves the concrete handler by
/// type, fetches the pipeline behaviors registered for that request/response pair,
/// and composes them into a nested delegate chain (outermost = first registered).
/// </summary>
/// <remarks>
/// Pipeline composition uses a single reflection hop to re-enter a strongly-typed
/// generic method — thereafter the chain is typed and allocation-free. This is the
/// standard pattern (MediatR, MassTransit); hot-path benchmarks haven't been run,
/// delegate caching is a future optimization.
/// </remarks>
public sealed class Dispatcher(IServiceProvider serviceProvider) : IDispatcher
{
    private readonly IServiceProvider _serviceProvider = serviceProvider
        ?? throw new ArgumentNullException(nameof(serviceProvider));

    /// <inheritdoc />
    public Task SendAsync(ICommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var method = typeof(Dispatcher)
            .GetMethod(nameof(SendVoidInternalAsync), BindingFlags.NonPublic | BindingFlags.Instance)!
            .MakeGenericMethod(command.GetType());
        return (Task)method.Invoke(this, [command, cancellationToken])!;
    }

    /// <inheritdoc />
    public Task<TResult> SendAsync<TResult>(ICommand<TResult> command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var method = typeof(Dispatcher)
            .GetMethod(nameof(SendInternalAsync), BindingFlags.NonPublic | BindingFlags.Instance)!
            .MakeGenericMethod(command.GetType(), typeof(TResult));
        return (Task<TResult>)method.Invoke(this, [command, cancellationToken])!;
    }

    /// <inheritdoc />
    public Task<TResult> QueryAsync<TResult>(IQuery<TResult> query, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(query);

        var method = typeof(Dispatcher)
            .GetMethod(nameof(QueryInternalAsync), BindingFlags.NonPublic | BindingFlags.Instance)!
            .MakeGenericMethod(query.GetType(), typeof(TResult));
        return (Task<TResult>)method.Invoke(this, [query, cancellationToken])!;
    }

    private async Task SendVoidInternalAsync<TCommand>(TCommand command, CancellationToken cancellationToken)
        where TCommand : ICommand
    {
        var handler = _serviceProvider.GetRequiredService<ICommandHandler<TCommand>>();
        var behaviors = _serviceProvider.GetServices<IPipelineBehavior<TCommand, Unit>>().Reverse();

        RequestHandlerDelegate<Unit> pipeline = async () =>
        {
            await handler.HandleAsync(command, cancellationToken).ConfigureAwait(false);
            return Unit.Value;
        };

        foreach (var behavior in behaviors)
        {
            var next = pipeline;
            pipeline = () => behavior.HandleAsync(command, next, cancellationToken);
        }

        await pipeline().ConfigureAwait(false);
    }

    private async Task<TResult> SendInternalAsync<TCommand, TResult>(
        TCommand command,
        CancellationToken cancellationToken)
        where TCommand : ICommand<TResult>
    {
        var handler = _serviceProvider.GetRequiredService<ICommandHandler<TCommand, TResult>>();
        var behaviors = _serviceProvider.GetServices<IPipelineBehavior<TCommand, TResult>>().Reverse();

        RequestHandlerDelegate<TResult> pipeline = () => handler.HandleAsync(command, cancellationToken);

        foreach (var behavior in behaviors)
        {
            var next = pipeline;
            pipeline = () => behavior.HandleAsync(command, next, cancellationToken);
        }

        return await pipeline().ConfigureAwait(false);
    }

    private async Task<TResult> QueryInternalAsync<TQuery, TResult>(
        TQuery query,
        CancellationToken cancellationToken)
        where TQuery : IQuery<TResult>
    {
        var handler = _serviceProvider.GetRequiredService<IQueryHandler<TQuery, TResult>>();
        var behaviors = _serviceProvider.GetServices<IPipelineBehavior<TQuery, TResult>>().Reverse();

        RequestHandlerDelegate<TResult> pipeline = () => handler.HandleAsync(query, cancellationToken);

        foreach (var behavior in behaviors)
        {
            var next = pipeline;
            pipeline = () => behavior.HandleAsync(query, next, cancellationToken);
        }

        return await pipeline().ConfigureAwait(false);
    }
}

/// <summary>
/// Void placeholder — stands in for <c>ICommandHandler&lt;TCommand&gt;</c>'s "no
/// response" so the pipeline can use the same generic shape as the result-carrying
/// handlers. Mirrors MediatR's <c>Unit</c>.
/// </summary>
public readonly struct Unit : IEquatable<Unit>
{
    /// <summary>The only <see cref="Unit"/> value.</summary>
    public static readonly Unit Value;

    /// <inheritdoc />
    public bool Equals(Unit other) => true;

    /// <inheritdoc />
    public override bool Equals(object? obj) => obj is Unit;

    /// <inheritdoc />
    public override int GetHashCode() => 0;

    /// <summary>Equality operator — all <see cref="Unit"/> values are equal.</summary>
    public static bool operator ==(Unit left, Unit right) => left.Equals(right);

    /// <summary>Inequality operator — always <c>false</c> for <see cref="Unit"/>.</summary>
    public static bool operator !=(Unit left, Unit right) => !left.Equals(right);
}
