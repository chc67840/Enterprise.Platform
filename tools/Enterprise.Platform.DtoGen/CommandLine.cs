namespace Enterprise.Platform.DtoGen;

/// <summary>
/// Minimal argument parser and command dispatcher for DtoGen. Keeps the tool
/// dependency-free (no System.CommandLine / Spectre.Console) so it runs on any
/// box with the .NET 10 SDK.
/// </summary>
internal static class CommandLine
{
    private const string UsageText = """
        Enterprise.Platform.DtoGen — DTO + Mapster config generator

        Usage:
          dotnet run --project tools/Enterprise.Platform.DtoGen -- [options]

        Required options:
          --entities      <path>   Directory containing scaffolded EF entity .cs files
          --dto-out       <path>   Output directory for {Entity}Dto.cs
          --mapping-out   <path>   Output directory for the Mapster registry + configs
          --namespace-dto <ns>     Namespace to emit for DTO classes
          --namespace-map <ns>     Namespace to emit for mapping classes

        Optional:
          --dry-run                Print the file list that would be written; do not touch disk
          --force                  Overwrite existing generated files (default: true for idempotency)
          --help, -h               Show this help

        Example (Phase 6):
          dotnet run --project tools/Enterprise.Platform.DtoGen -- \
            --entities      src/Infrastructure/Enterprise.Platform.Infrastructure/Persistence/EventShopper/Entities \
            --dto-out       src/Contracts/Enterprise.Platform.Contracts/DTOs/EventShopper \
            --mapping-out   src/Infrastructure/Enterprise.Platform.Infrastructure/Persistence/EventShopper/Mappings \
            --namespace-dto Enterprise.Platform.Contracts.DTOs.EventShopper \
            --namespace-map Enterprise.Platform.Infrastructure.Persistence.EventShopper.Mappings
        """;

    internal static Task<int> RunAsync(string[] args)
    {
        if (args.Length == 0 || args.Contains("--help") || args.Contains("-h"))
        {
            Console.WriteLine(UsageText);
            return Task.FromResult(0);
        }

        // Parse key/value flags into a dictionary for the generator to consume.
        Dictionary<string, string> flags = new(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < args.Length; i++)
        {
            if (!args[i].StartsWith("--", StringComparison.Ordinal)) continue;
            var key = args[i];
            var value = (i + 1 < args.Length && !args[i + 1].StartsWith("--", StringComparison.Ordinal))
                ? args[++i]
                : "true";
            flags[key] = value;
        }

        // Phase 0 ships only the CLI skeleton. Phase 6 wires in the real generator
        // once scaffolded entities exist to roundtrip against.
        Console.Error.WriteLine("DtoGen CLI skeleton ready — generator implementation lands in Phase 6.");
        Console.Error.WriteLine($"Received {flags.Count} flag(s): {string.Join(", ", flags.Keys)}");
        return Task.FromResult(2); // non-zero so a build pipeline wouldn't treat this as a successful codegen
    }
}
