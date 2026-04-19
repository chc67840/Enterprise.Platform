using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;

namespace Enterprise.Platform.Infrastructure.Persistence;

/// <summary>
/// Singleton registry mapping logical database names to their concrete
/// <see cref="DbContext"/> types. Populated by <c>AddInfrastructure</c> as each
/// <c>AddDbContext&lt;TContext&gt;</c> call lands; consumed by
/// <see cref="DbContextFactory"/> to resolve contexts by logical name at runtime.
/// </summary>
public sealed class DbContextRegistry
{
    private readonly ConcurrentDictionary<string, Type> _map = new(StringComparer.Ordinal);

    /// <summary>Name used to resolve the "default" context when callers omit one.</summary>
    public string? DefaultLogicalName { get; private set; }

    /// <summary>
    /// Registers <typeparamref name="TContext"/> against <paramref name="logicalName"/>.
    /// Idempotent — re-registering the same name with the same type is a no-op;
    /// re-registering with a different type throws.
    /// </summary>
    public DbContextRegistry Register<TContext>(string logicalName, bool isDefault = false)
        where TContext : DbContext
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(logicalName);

        _map.AddOrUpdate(
            logicalName,
            typeof(TContext),
            (key, existing) => existing == typeof(TContext)
                ? existing
                : throw new InvalidOperationException(
                    $"Logical name '{key}' is already registered to {existing.Name}; cannot rebind to {typeof(TContext).Name}."));

        if (isDefault)
        {
            DefaultLogicalName = logicalName;
        }

        return this;
    }

    /// <summary>Resolves the context type for <paramref name="logicalName"/>. Returns <c>null</c> when absent.</summary>
    public Type? Resolve(string logicalName)
        => _map.TryGetValue(logicalName, out var type) ? type : null;

    /// <summary>All registered logical names (read-only snapshot).</summary>
    public IReadOnlyCollection<string> LogicalNames => _map.Keys.ToArray();
}
