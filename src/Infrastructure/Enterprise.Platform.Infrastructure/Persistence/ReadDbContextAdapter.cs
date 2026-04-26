using Enterprise.Platform.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Enterprise.Platform.Infrastructure.Persistence;

/// <summary>
/// P2-6 (audit) — adapter that wraps a write <see cref="DbContext"/> and exposes
/// the read-only <see cref="IReadDbContext"/> contract with <c>AsNoTracking()</c>
/// applied automatically. Read handlers consuming <see cref="IReadDbContext"/>
/// physically cannot get a tracked entity through this surface, so the
/// "forgot to call AsNoTracking" footgun closes.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why not put AsNoTracking inside the DbContext itself?</b> The same context
/// is used for writes (<c>UnitOfWork&lt;TContext&gt;</c>); a global
/// <c>QueryTrackingBehavior.NoTracking</c> setting would force write handlers
/// to opt INTO tracking on every entity. The adapter pattern keeps the write
/// path untouched while making the read path safe-by-default.
/// </para>
/// <para>
/// <b>Registration.</b> Hosts register per-context:
/// <code>
/// services.AddScoped&lt;IReadDbContext&gt;(sp =&gt;
///     new ReadDbContextAdapter&lt;AppDbContext&gt;(sp.GetRequiredService&lt;AppDbContext&gt;()));
/// </code>
/// When a host has multiple contexts, register a keyed variant or pull from the
/// <c>DbContextRegistry</c>.
/// </para>
/// </remarks>
public sealed class ReadDbContextAdapter<TContext>(TContext context) : IReadDbContext
    where TContext : DbContext
{
    private readonly TContext _context = context ?? throw new ArgumentNullException(nameof(context));

    /// <inheritdoc />
    /// <remarks>
    /// Always returns an untracked queryable. Caller-side projection
    /// (<c>.Select(...)</c>) is required for every read; never materialise
    /// the entity directly.
    /// </remarks>
    public IQueryable<T> Set<T>() where T : class
        => _context.Set<T>().AsNoTracking();
}
