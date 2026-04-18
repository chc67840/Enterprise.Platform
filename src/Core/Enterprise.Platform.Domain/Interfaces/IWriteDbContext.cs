namespace Enterprise.Platform.Domain.Interfaces;

/// <summary>
/// Minimal write-side context — the platform deliberately keeps Domain free of any
/// EF Core surface. Handlers write through <see cref="IGenericRepository{T}"/>, and
/// the unit of work commits through <see cref="IUnitOfWork"/>; this interface exists
/// for infrastructure / test scenarios that need a handle to the transactional
/// context itself.
/// </summary>
public interface IWriteDbContext
{
    /// <summary>Persists pending changes. Returns the number of state entries written.</summary>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
