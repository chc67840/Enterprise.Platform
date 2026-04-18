namespace Enterprise.Platform.Domain.Interfaces;

/// <summary>
/// Transaction boundary + flush point. A single logical unit of work groups repository
/// calls so they succeed or fail together. The <c>TransactionBehavior</c> pipeline
/// step wraps command handlers in an implicit <see cref="SaveChangesAsync"/>; explicit
/// transactions are reserved for multi-repository operations that need strict control.
/// </summary>
public interface IUnitOfWork : IAsyncDisposable
{
    /// <summary>Persists pending changes. Returns the number of state entries written.</summary>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>Begins an explicit transaction. Nested calls are no-ops.</summary>
    Task BeginTransactionAsync(CancellationToken cancellationToken = default);

    /// <summary>Commits the active transaction. No-op when no transaction is active.</summary>
    Task CommitTransactionAsync(CancellationToken cancellationToken = default);

    /// <summary>Rolls back the active transaction. No-op when no transaction is active.</summary>
    Task RollbackTransactionAsync(CancellationToken cancellationToken = default);
}
