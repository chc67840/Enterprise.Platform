using System.Data.Common;
using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Contracts.Settings;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Infrastructure.Persistence;

/// <summary>
/// Opens raw <see cref="DbConnection"/> instances for the Dapper / ADO.NET read path.
/// Resolves the connection string via <see cref="IConfiguration"/> using the logical
/// name's <see cref="DatabaseConnectionSettings.ConnectionStringName"/> indirection,
/// so Key Vault / user-secrets overrides continue to work unchanged.
/// </summary>
public sealed class DbConnectionFactory(
    IOptionsMonitor<DatabaseSettings> settings,
    IConfiguration configuration) : IDbConnectionFactory
{
    private readonly IOptionsMonitor<DatabaseSettings> _settings = settings
        ?? throw new ArgumentNullException(nameof(settings));

    private readonly IConfiguration _configuration = configuration
        ?? throw new ArgumentNullException(nameof(configuration));

    /// <inheritdoc />
    public async Task<DbConnection> CreateConnectionAsync(
        string logicalName,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(logicalName);

        if (!_settings.CurrentValue.Connections.TryGetValue(logicalName, out var entry))
        {
            throw new InvalidOperationException(
                $"No DatabaseSettings entry for logical name '{logicalName}'.");
        }

        var connectionString = _configuration.GetConnectionString(entry.ConnectionStringName)
            ?? throw new InvalidOperationException(
                $"Connection string '{entry.ConnectionStringName}' is missing from configuration.");

        DbConnection connection = entry.Provider switch
        {
            DatabaseProvider.SqlServer => new SqlConnection(connectionString),
            DatabaseProvider.PostgreSql => throw new NotSupportedException(
                "PostgreSQL provider is not wired yet — add Npgsql once a Postgres DB is introduced."),
            DatabaseProvider.InMemory => throw new NotSupportedException(
                "InMemory provider is for tests only and cannot open a DbConnection."),
            _ => throw new NotSupportedException($"Unknown provider '{entry.Provider}'."),
        };

        try
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
            return connection;
        }
        catch
        {
            await connection.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }
}
