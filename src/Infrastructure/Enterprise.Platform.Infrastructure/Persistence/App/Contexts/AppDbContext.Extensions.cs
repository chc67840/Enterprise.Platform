using Enterprise.Platform.Infrastructure.Persistence.App.Entities;
using Microsoft.EntityFrameworkCore;

namespace Enterprise.Platform.Infrastructure.Persistence.App.Contexts;

/// <summary>
/// Hand-authored partial that layers custom <c>OnModelCreating</c> tweaks on
/// top of the scaffolded <see cref="AppDbContext"/>. Keep this file minimal —
/// most schema concerns belong in the SQL DDL (see <c>infra/db/scripts/App/</c>);
/// this partial is for runtime-only behaviour the scaffolder can't express.
/// </summary>
/// <remarks>
/// What's in here:
/// <list type="bullet">
///   <item>The soft-delete query filter for <see cref="Domain.Interfaces.ISoftDeletable"/> entities — applied at materialisation time, not at INSERT.</item>
/// </list>
/// What's <em>not</em> in here, intentionally:
/// <list type="bullet">
///   <item>Outbox <see cref="DbSet{TEntity}"/> / table config — the scaffolded <c>PlatformOutboxMessage</c> entity owns it now.</item>
///   <item>Per-entity column types / indexes — covered by the scaffolded <c>OnModelCreating</c> body.</item>
/// </list>
/// </remarks>
public partial class AppDbContext
{
    /// <summary>Hook implementation invoked from the scaffolded <see cref="OnModelCreating"/>.</summary>
    /// <remarks>
    /// CA1822 suppression: instance method by partial-method contract; EF Core
    /// always invokes it on the live <c>DbContext</c> instance during model build.
    /// </remarks>
#pragma warning disable CA1822
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
#pragma warning restore CA1822
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        // Override scaffold gotcha: EF reads the SQL DF_User_IsActive default and
        // marks the property as ValueGenerated.OnAdd. That silently swaps an
        // application-supplied `IsActive = false` for the DB default (`1`) on
        // INSERT. ValueGeneratedNever forces EF to always emit the property
        // value verbatim. The SQL default still applies for direct INSERT
        // statements that omit the column (e.g. SSMS / data-load scripts).
        modelBuilder.Entity<User>().Property(u => u.IsActive).ValueGeneratedNever();

        // Apply soft-delete query filter to any entity implementing ISoftDeletable.
        // Single-tenant: no tenant filter needed (multi-tenancy stripped 2026-04-25).
        modelBuilder.ApplySoftDeleteFilter();
    }
}
