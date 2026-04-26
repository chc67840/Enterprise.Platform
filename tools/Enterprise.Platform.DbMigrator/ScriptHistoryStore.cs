using System.Data;
using Microsoft.Data.SqlClient;

namespace Enterprise.Platform.DbMigrator;

/// <summary>
/// Read/write surface for the <c>__SchemaHistory</c> table — the migrator's
/// memory of what has already been applied. Bootstrapped on first run so the
/// migrator works against a brand-new database without requiring a manual
/// CREATE TABLE step.
/// </summary>
internal sealed class ScriptHistoryStore(string connectionString)
{
    private readonly string _connectionString = connectionString;

    /// <summary>Creates <c>__SchemaHistory</c> if it does not yet exist. Idempotent.</summary>
    public async Task EnsureCreatedAsync(CancellationToken cancellationToken)
    {
        const string ddl = """
            IF OBJECT_ID(N'dbo.__SchemaHistory', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.__SchemaHistory
                (
                    ScriptName    NVARCHAR(260) NOT NULL CONSTRAINT PK___SchemaHistory PRIMARY KEY,
                    AppliedAtUtc  DATETIMEOFFSET(7) NOT NULL CONSTRAINT DF___SchemaHistory_AppliedAtUtc DEFAULT (SYSUTCDATETIME()),
                    ScriptHash    CHAR(64)      NOT NULL,
                    ExecutionMs   INT           NOT NULL
                );
            END
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new SqlCommand(ddl, connection) { CommandType = CommandType.Text };
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Returns every applied script keyed by filename — the caller compares
    /// against on-disk file hashes to detect tampering.
    /// </summary>
    public async Task<IReadOnlyDictionary<string, AppliedScript>> ReadAllAsync(CancellationToken cancellationToken)
    {
        const string sql = "SELECT ScriptName, AppliedAtUtc, ScriptHash, ExecutionMs FROM dbo.__SchemaHistory;";

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);

        var map = new Dictionary<string, AppliedScript>(StringComparer.OrdinalIgnoreCase);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            var name = reader.GetString(0);
            map[name] = new AppliedScript(
                ScriptName: name,
                AppliedAtUtc: reader.GetDateTimeOffset(1),
                ScriptHash: reader.GetString(2),
                ExecutionMs: reader.GetInt32(3));
        }
        return map;
    }

    /// <summary>
    /// Records a successful apply. Caller is responsible for ensuring the
    /// script itself ran inside the same transaction (this method is *not*
    /// transactional with the script body — see <see cref="Migrator"/>).
    /// </summary>
    /// <remarks>
    /// Static because the connection + transaction are passed in by the caller
    /// (which holds the active transaction); the store itself doesn't open or
    /// dispose anything here, so no instance state is touched.
    /// </remarks>
    public static async Task RecordAppliedAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        string scriptName,
        string scriptHash,
        int executionMs,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO dbo.__SchemaHistory (ScriptName, AppliedAtUtc, ScriptHash, ExecutionMs)
            VALUES (@name, SYSUTCDATETIME(), @hash, @ms);
            """;

        await using var command = new SqlCommand(sql, connection, transaction);
        command.Parameters.Add("@name", SqlDbType.NVarChar, 260).Value = scriptName;
        command.Parameters.Add("@hash", SqlDbType.Char, 64).Value = scriptHash;
        command.Parameters.Add("@ms", SqlDbType.Int).Value = executionMs;
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }
}

/// <summary>One row from <c>__SchemaHistory</c>.</summary>
internal sealed record AppliedScript(string ScriptName, DateTimeOffset AppliedAtUtc, string ScriptHash, int ExecutionMs);
