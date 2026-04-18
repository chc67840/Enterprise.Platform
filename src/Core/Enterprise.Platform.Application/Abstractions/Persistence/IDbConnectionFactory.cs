using System.Data.Common;

namespace Enterprise.Platform.Application.Abstractions.Persistence;

/// <summary>
/// Opens raw <see cref="DbConnection"/> instances for the reporting / ADO.NET read
/// path (Dapper, hand-written SQL). Complements EF Core — which is reached through
/// <c>IGenericRepository&lt;T&gt;</c> / <c>IReadDbContext</c> — when an operation
/// outgrows LINQ or needs vendor-specific SQL.
/// </summary>
public interface IDbConnectionFactory
{
    /// <summary>
    /// Opens a connection keyed by logical database name (<c>"EventShopper"</c>,
    /// <c>"Platform"</c>, etc.). The caller owns the returned connection and must
    /// dispose it.
    /// </summary>
    Task<DbConnection> CreateConnectionAsync(
        string logicalName,
        CancellationToken cancellationToken = default);
}
