using Microsoft.EntityFrameworkCore;

namespace Enterprise.Platform.Infrastructure.Persistence.App.Contexts;

/// <summary>
/// Single bounded-context DbContext for the platform. Replaces the earlier
/// EventShopper DB-first scaffold (wiped 2026-04-25 for the single-tenant
/// recreation pass).
/// </summary>
/// <remarks>
/// Currently has zero business <see cref="DbSet{TEntity}"/>s — entities will be
/// added as features land via:
/// <list type="number">
///   <item>Hand-written aggregate root in <c>Domain/Aggregates/{Aggregate}/</c> inheriting <c>BaseEntity</c> / <c>AuditableEntity</c> / <c>AggregateRoot</c>.</item>
///   <item>Fluent <see cref="IEntityTypeConfiguration{TEntity}"/> in <c>Infrastructure/Persistence/App/Configurations/</c>.</item>
///   <item>EF migration via <c>dotnet ef migrations add &lt;Name&gt;</c>.</item>
/// </list>
/// The platform-level outbox table (<c>PlatformOutboxMessages</c>) is configured in
/// the partial extension class <c>AppDbContext.Extensions.cs</c> so it's never lost
/// to a future re-scan.
/// </remarks>
public partial class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        // Apply IEntityTypeConfiguration<T> classes from this assembly. Each
        // configuration lives in Persistence/App/Configurations/{EntityName}Configuration.cs.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Hook the partial method (PlatformOutbox + soft-delete query filter).
        OnModelCreatingPartial(modelBuilder);
    }

    /// <summary>Partial hook implemented in <c>AppDbContext.Extensions.cs</c>.</summary>
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
