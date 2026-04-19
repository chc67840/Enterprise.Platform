using Enterprise.Platform.Application.Abstractions.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Enterprise.Platform.Infrastructure.Persistence;

/// <summary>
/// Default <see cref="IDbContextFactory"/> implementation. Resolves contexts from the
/// current DI scope so they share the unit-of-work with handlers injected in the same
/// request. Uses <see cref="DbContextRegistry"/> for logical-name → type mapping.
/// </summary>
public sealed class DbContextFactory(
    IServiceProvider serviceProvider,
    DbContextRegistry registry) : IDbContextFactory
{
    private readonly IServiceProvider _serviceProvider = serviceProvider
        ?? throw new ArgumentNullException(nameof(serviceProvider));

    private readonly DbContextRegistry _registry = registry
        ?? throw new ArgumentNullException(nameof(registry));

    /// <inheritdoc />
    public TContext GetContext<TContext>() where TContext : DbContext
    {
        var logicalName = _registry.DefaultLogicalName
            ?? throw new InvalidOperationException(
                "No default logical database has been registered. Call DbContextRegistry.Register(..., isDefault: true) during DI setup.");
        return GetContext<TContext>(logicalName);
    }

    /// <inheritdoc />
    public TContext GetContext<TContext>(string logicalName) where TContext : DbContext
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(logicalName);

        var registered = _registry.Resolve(logicalName)
            ?? throw new InvalidOperationException(
                $"No DbContext is registered for logical name '{logicalName}'.");

        if (!typeof(TContext).IsAssignableFrom(registered))
        {
            throw new InvalidOperationException(
                $"Logical name '{logicalName}' resolves to {registered.Name}, not {typeof(TContext).Name}.");
        }

        return (TContext)_serviceProvider.GetService(registered)!
            ?? throw new InvalidOperationException(
                $"{registered.Name} is registered in the registry but not resolvable from DI — did AddDbContext<{registered.Name}>() land?");
    }

    /// <inheritdoc />
    public DbContext GetContext(string logicalName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(logicalName);

        var registered = _registry.Resolve(logicalName)
            ?? throw new InvalidOperationException(
                $"No DbContext is registered for logical name '{logicalName}'.");

        return (DbContext)_serviceProvider.GetService(registered)!
            ?? throw new InvalidOperationException(
                $"{registered.Name} is registered in the registry but not resolvable from DI.");
    }
}
