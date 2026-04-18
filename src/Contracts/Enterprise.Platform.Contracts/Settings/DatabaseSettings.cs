namespace Enterprise.Platform.Contracts.Settings;

/// <summary>
/// Root configuration binding for all database connections used by the platform.
/// Supports multi-provider, multi-database deployments (e.g. MSSQL + PostgreSQL).
/// </summary>
/// <remarks>
/// Expected <c>appsettings.json</c> shape:
/// <code>
/// {
///   "ConnectionStrings": {
///     "EventShopperDb": "Data Source=..."
///   },
///   "DatabaseSettings": {
///     "DefaultConnection": "EventShopper",
///     "Connections": {
///       "EventShopper": {
///         "ConnectionStringName": "EventShopperDb",
///         "Provider": "SqlServer",
///         "CommandTimeoutSeconds": 30,
///         "IsReadReplica": false,
///         "EnableSensitiveDataLogging": false,
///         "EnableDetailedErrors": true
///       }
///     }
///   }
/// }
/// </code>
/// </remarks>
public sealed class DatabaseSettings
{
    /// <summary>
    /// Configuration section key. Use with <c>Configuration.GetSection(DatabaseSettings.SectionName)</c>.
    /// </summary>
    public const string SectionName = "DatabaseSettings";

    /// <summary>
    /// Logical name of the connection that handlers receive when they don't specify one.
    /// Must match a key in <see cref="Connections"/>.
    /// </summary>
    public string DefaultConnection { get; set; } = string.Empty;

    /// <summary>
    /// Registry of named logical connections. Keyed by the logical name
    /// (e.g. <c>"EventShopper"</c>, <c>"Platform"</c>, <c>"ReportsPostgres"</c>) that
    /// <see cref="IDbContextFactory"/> consumers use to resolve contexts.
    /// </summary>
    public Dictionary<string, DatabaseConnectionSettings> Connections { get; set; } = new();
}

/// <summary>
/// Settings for a single logical database connection.
/// </summary>
public sealed class DatabaseConnectionSettings
{
    /// <summary>
    /// Key into the top-level <c>ConnectionStrings</c> section of configuration.
    /// Indirection keeps raw connection strings out of this POCO so Key Vault
    /// / user-secrets overrides continue to work through the standard
    /// <c>Configuration.GetConnectionString()</c> resolution path.
    /// </summary>
    public string ConnectionStringName { get; set; } = string.Empty;

    /// <summary>
    /// Database provider this connection targets. Keep the string stable — the
    /// <see cref="IDbContextFactory"/> implementation switches on it to pick
    /// the EF Core provider (<c>UseSqlServer</c> / <c>UseNpgsql</c> / ...).
    /// </summary>
    public DatabaseProvider Provider { get; set; } = DatabaseProvider.SqlServer;

    /// <summary>
    /// Per-command timeout in seconds. <c>0</c> means "no timeout" (SQL Server default).
    /// Tune per DB — long reporting queries and quick OLTP reads usually want different values.
    /// </summary>
    public int CommandTimeoutSeconds { get; set; }

    /// <summary>
    /// When true, the factory routes reads through this connection only. Write
    /// operations resolved against a read-replica must throw to prevent silent drift.
    /// </summary>
    public bool IsReadReplica { get; set; }

    /// <summary>
    /// Enables EF Core's parameter-value logging. <b>Never true in production</b> —
    /// leaks PII into logs.
    /// </summary>
    public bool EnableSensitiveDataLogging { get; set; }

    /// <summary>
    /// Enables EF Core's detailed exception messages. Safe in non-prod; helpful
    /// when diagnosing query-translation failures.
    /// </summary>
    public bool EnableDetailedErrors { get; set; }
}

/// <summary>
/// Supported EF Core providers. Extend as new databases are added.
/// </summary>
public enum DatabaseProvider
{
    /// <summary>Microsoft SQL Server / Azure SQL.</summary>
    SqlServer = 0,

    /// <summary>PostgreSQL via Npgsql.</summary>
    PostgreSql = 1,

    /// <summary>In-memory provider — tests only.</summary>
    InMemory = 99
}
