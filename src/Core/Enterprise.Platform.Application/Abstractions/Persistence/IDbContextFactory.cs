using Microsoft.EntityFrameworkCore;

namespace Enterprise.Platform.Application.Abstractions.Persistence;

/// <summary>
/// Resolves an EF Core <see cref="DbContext"/> by logical database name (per D3:
/// one <see cref="DbContext"/> per logical database). Handlers inject this instead
/// of specific contexts when they need to branch on the target DB at runtime.
/// </summary>
/// <remarks>
/// Registration flow (Infrastructure): <c>AddDbContext&lt;TContext&gt;</c> + a call to
/// <c>RegisterDbContext&lt;TContext&gt;("logicalName")</c> that populates the
/// <c>DbContextRegistry</c>. Resolution reaches back into the DI scope so every
/// returned context participates in the request's unit-of-work.
/// </remarks>
public interface IDbContextFactory
{
    /// <summary>Resolves the context registered against the logical default connection.</summary>
    TContext GetContext<TContext>() where TContext : DbContext;

    /// <summary>Resolves the context registered against <paramref name="logicalName"/>.</summary>
    /// <exception cref="InvalidOperationException">No context is registered for that name.</exception>
    TContext GetContext<TContext>(string logicalName) where TContext : DbContext;

    /// <summary>Resolves the <see cref="DbContext"/> for <paramref name="logicalName"/> without a compile-time type.</summary>
    /// <exception cref="InvalidOperationException">No context is registered for that name.</exception>
    DbContext GetContext(string logicalName);
}
