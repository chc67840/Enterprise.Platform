namespace Enterprise.Platform.Domain.Interfaces;

/// <summary>
/// Read-side projection surface. Exposes <see cref="IQueryable{T}"/> for each tracked
/// entity so read handlers can compose projections directly (<c>Set&lt;T&gt;().Select(...)</c>)
/// without going through the write-side repository. Implementations must apply
/// <c>AsNoTracking</c> globally — no entity materialised through this interface is
/// tracked by the context.
/// </summary>
public interface IReadDbContext
{
    /// <summary>Returns an untracked <see cref="IQueryable{T}"/> over the <typeparamref name="T"/> set.</summary>
    IQueryable<T> Set<T>() where T : class;
}
