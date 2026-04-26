using Enterprise.Platform.DbMigrator;
using Microsoft.Extensions.Configuration;

// ─── DbMigrator entry point ──────────────────────────────────────────────────
//
// Usage:
//   dotnet run --project tools/Enterprise.Platform.DbMigrator -- <DbName> [options]
//
// Examples:
//   dotnet run --project tools/Enterprise.Platform.DbMigrator -- App
//   dotnet run --project tools/Enterprise.Platform.DbMigrator -- App --connection-string "Server=...;Database=..."
//   dotnet run --project tools/Enterprise.Platform.DbMigrator -- App --scripts-root ./infra/db/scripts --dry-run
//
// Connection string resolution order (first match wins):
//   1. --connection-string <value> CLI option
//   2. Environment variable EP_DBMIGRATOR_<DBNAME>_CONNECTION
//   3. appsettings.{Environment}.json → ConnectionStrings:<DbName>
//   4. appsettings.json → ConnectionStrings:<DbName>
//
// Exit codes:
//   0  success (or no scripts to apply)
//   1  CLI / configuration error
//   2  schema-integrity check failed (a previously-applied script's content has changed)
//   3  SQL error during script execution
//
// See infra/db/CONVENTIONS.md for the full schema-authoring contract.
// ────────────────────────────────────────────────────────────────────────────

try
{
    var options = MigratorOptions.Parse(args);
    if (options is null)
    {
        return 1;
    }

    var configuration = new ConfigurationBuilder()
        .SetBasePath(AppContext.BaseDirectory)
        .AddJsonFile("appsettings.json", optional: true)
        .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") ?? "Development"}.json", optional: true)
        .AddEnvironmentVariables()
        .Build();

    var connectionString = ResolveConnectionString(options, configuration);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        Console.Error.WriteLine(
            $"FATAL: no connection string for database '{options.DbName}'. " +
            "Set --connection-string, EP_DBMIGRATOR_{DBNAME}_CONNECTION env var, " +
            "or ConnectionStrings:{DbName} in appsettings.json.");
        return 1;
    }

    var scriptsRoot = options.ScriptsRoot ?? Path.Combine(FindRepoRoot(), "infra", "db", "scripts");
    var scriptFolder = Path.Combine(scriptsRoot, options.DbName);
    if (!Directory.Exists(scriptFolder))
    {
        Console.Error.WriteLine($"FATAL: script folder does not exist: {scriptFolder}");
        return 1;
    }

    var migrator = new Migrator(connectionString, scriptFolder, options.DryRun);
    await migrator.RunAsync(CancellationToken.None).ConfigureAwait(false);

    return 0;
}
catch (SchemaIntegrityException ex)
{
    Console.Error.WriteLine($"SCHEMA INTEGRITY ERROR: {ex.Message}");
    return 2;
}
catch (Microsoft.Data.SqlClient.SqlException ex)
{
    Console.Error.WriteLine($"SQL ERROR: {ex.Message}");
    return 3;
}
catch (Exception ex)
{
    Console.Error.WriteLine($"UNEXPECTED: {ex}");
    return 1;
}

// ─── Connection-string resolution ────────────────────────────────────────────

static string? ResolveConnectionString(MigratorOptions options, IConfiguration configuration)
{
    if (!string.IsNullOrWhiteSpace(options.ConnectionString))
    {
        return options.ConnectionString;
    }

    var envVar = $"EP_DBMIGRATOR_{options.DbName.ToUpperInvariant()}_CONNECTION";
    var envValue = Environment.GetEnvironmentVariable(envVar);
    if (!string.IsNullOrWhiteSpace(envValue))
    {
        return envValue;
    }

    return configuration.GetSection("ConnectionStrings")[options.DbName];
}

// ─── Repo-root discovery ─────────────────────────────────────────────────────
// Walks upward from the executable looking for the solution file. Lets devs run
// the migrator from any working directory (`dotnet run --project …`) without
// passing --scripts-root explicitly.

static string FindRepoRoot()
{
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir is not null)
    {
        if (dir.GetFiles("*.slnx").Length > 0 || dir.GetFiles("*.sln").Length > 0)
        {
            return dir.FullName;
        }
        dir = dir.Parent;
    }
    throw new InvalidOperationException(
        "Could not locate repository root (no .slnx / .sln found walking up from " +
        $"{AppContext.BaseDirectory}). Pass --scripts-root explicitly.");
}
