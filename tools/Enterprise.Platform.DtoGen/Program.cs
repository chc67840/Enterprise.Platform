using Enterprise.Platform.DtoGen;

// ─── DtoGen entry ────────────────────────────────────────────────────────────
//
// Usage:
//   dotnet run --project tools/Enterprise.Platform.DtoGen -- generate <DbName> [--dry-run]
//
// Examples:
//   dotnet run --project tools/Enterprise.Platform.DtoGen -- generate App
//   dotnet run --project tools/Enterprise.Platform.DtoGen -- generate App --dry-run
//
// Reads tools/Enterprise.Platform.DtoGen/configs/<DbName>.json for input/output
// paths and namespace settings; emits DTOs + mappers + the per-database
// MappingRegistry into Contracts/.
//
// Exit codes:
//   0  success
//   1  CLI / config error
//   2  generator error (Roslyn parse / IO)
// ────────────────────────────────────────────────────────────────────────────

if (args.Length == 0 || args[0] is "--help" or "-h" or "/?")
{
    PrintUsage();
    return args.Length == 0 ? 1 : 0;
}

if (args[0] != "generate")
{
    Console.Error.WriteLine($"FATAL: unknown command '{args[0]}'. Run with --help.");
    return 1;
}

if (args.Length < 2)
{
    Console.Error.WriteLine("FATAL: 'generate' requires a database name (e.g. 'App').");
    return 1;
}

var dbName = args[1];
var dryRun = args.Skip(2).Any(a => a is "--dry-run" or "-d");

var configPath = Path.Combine(AppContext.BaseDirectory, "configs", dbName + ".json");
var repoRoot = FindRepoRoot();

try
{
    var generator = new Generator(repoRoot);
    return await generator.RunAsync(configPath, dryRun, CancellationToken.None).ConfigureAwait(false);
}
catch (Exception ex)
{
    Console.Error.WriteLine($"GENERATOR ERROR: {ex.Message}");
    Console.Error.WriteLine(ex.StackTrace);
    return 2;
}

static void PrintUsage()
{
    Console.WriteLine("""
        Enterprise.Platform.DtoGen — emits DTOs + extension-method mappers + IMapper registry from
        scaffolded EF entities. No runtime third-party dependency.

        Usage:
            dotnet run --project tools/Enterprise.Platform.DtoGen -- generate <DbName> [--dry-run]

        Arguments:
            <DbName>    Logical database name. Must match a config file at
                        tools/Enterprise.Platform.DtoGen/configs/<DbName>.json.

        Options:
            -d, --dry-run    Print what would be written; touch nothing.
            -h, --help       Show this message.

        Exit codes: 0 success · 1 CLI/config · 2 generator error.
        """);
}

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
        "Could not locate repository root walking up from " + AppContext.BaseDirectory);
}
