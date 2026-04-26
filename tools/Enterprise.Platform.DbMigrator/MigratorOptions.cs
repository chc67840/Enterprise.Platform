namespace Enterprise.Platform.DbMigrator;

/// <summary>
/// Parsed CLI options. Returned <c>null</c> from <see cref="Parse"/> when the
/// caller asked for <c>--help</c> or supplied invalid arguments — caller exits
/// with code 1 in either case (help is informational, not an error, but the
/// migrator has no work to do).
/// </summary>
internal sealed record MigratorOptions(
    string DbName,
    string? ConnectionString,
    string? ScriptsRoot,
    bool DryRun)
{
    public static MigratorOptions? Parse(string[] args)
    {
        if (args.Length == 0 || args[0] is "--help" or "-h" or "/?" )
        {
            PrintUsage();
            return null;
        }

        var dbName = args[0];
        if (dbName.StartsWith('-'))
        {
            Console.Error.WriteLine("FATAL: first argument must be the database name (e.g. 'App').");
            PrintUsage();
            return null;
        }

        string? connectionString = null;
        string? scriptsRoot = null;
        var dryRun = false;

        for (var i = 1; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--connection-string" or "-c":
                    if (++i >= args.Length) { Console.Error.WriteLine("FATAL: --connection-string requires a value."); return null; }
                    connectionString = args[i];
                    break;

                case "--scripts-root" or "-r":
                    if (++i >= args.Length) { Console.Error.WriteLine("FATAL: --scripts-root requires a value."); return null; }
                    scriptsRoot = args[i];
                    break;

                case "--dry-run" or "-d":
                    dryRun = true;
                    break;

                default:
                    Console.Error.WriteLine($"FATAL: unknown option '{args[i]}'.");
                    PrintUsage();
                    return null;
            }
        }

        return new MigratorOptions(dbName, connectionString, scriptsRoot, dryRun);
    }

    private static void PrintUsage()
    {
        Console.WriteLine("""
            Enterprise.Platform.DbMigrator — applies SQL DDL scripts in order, tracks
            applied state in __SchemaHistory, refuses to re-run scripts whose hash on
            disk has changed since they were applied.

            Usage:
                dotnet run --project tools/Enterprise.Platform.DbMigrator -- <DbName> [options]

            Arguments:
                <DbName>                Logical database name. Matches a folder under
                                        infra/db/scripts/, e.g. 'App'.

            Options:
                -c, --connection-string <value>
                                        Override connection string. Otherwise read from
                                        EP_DBMIGRATOR_<DBNAME>_CONNECTION env var, then
                                        appsettings.{Env}.json → ConnectionStrings:<DbName>.

                -r, --scripts-root <path>
                                        Override script folder root. Default: <repo>/infra/db/scripts.

                -d, --dry-run           Show what would be applied; make no changes.

                -h, --help              Show this message.

            Exit codes: 0 success · 1 CLI/config · 2 schema integrity · 3 SQL.
            """);
    }
}
