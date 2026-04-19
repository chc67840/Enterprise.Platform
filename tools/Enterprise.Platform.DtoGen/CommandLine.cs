namespace Enterprise.Platform.DtoGen;

/// <summary>
/// Minimal argument parser and command dispatcher for DtoGen. Keeps the tool
/// dependency-free (no System.CommandLine / Spectre.Console) so it runs on any
/// box with the .NET 10 SDK. Delegates to <see cref="Generator"/> for the real work.
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

    internal static async Task<int> RunAsync(string[] args)
    {
        if (args.Length == 0 || args.Contains("--help") || args.Contains("-h"))
        {
            Console.WriteLine(UsageText);
            return 0;
        }

        Dictionary<string, string> flags = new(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < args.Length; i++)
        {
            if (!args[i].StartsWith("--", StringComparison.Ordinal))
            {
                continue;
            }

            var key = args[i];
            var value = i + 1 < args.Length && !args[i + 1].StartsWith("--", StringComparison.Ordinal)
                ? args[++i]
                : "true";
            flags[key] = value;
        }

        if (!TryGet(flags, "--entities", out var entities)
            || !TryGet(flags, "--dto-out", out var dtoOut)
            || !TryGet(flags, "--mapping-out", out var mappingOut)
            || !TryGet(flags, "--namespace-dto", out var nsDto)
            || !TryGet(flags, "--namespace-map", out var nsMap))
        {
            Console.Error.WriteLine("error: missing one or more required flags. Run with --help for usage.");
            return 1;
        }

        var options = new GeneratorOptions(
            EntitiesDirectory: entities,
            DtoOutputDirectory: dtoOut,
            MappingOutputDirectory: mappingOut,
            DtoNamespace: nsDto,
            MappingNamespace: nsMap,
            DryRun: flags.ContainsKey("--dry-run"),
            Force: !flags.TryGetValue("--force", out var f) || string.Equals(f, "true", StringComparison.OrdinalIgnoreCase));

        return await Generator.RunAsync(options).ConfigureAwait(false);
    }

    private static bool TryGet(Dictionary<string, string> flags, string key, out string value)
    {
        if (flags.TryGetValue(key, out var v) && !string.Equals(v, "true", StringComparison.OrdinalIgnoreCase))
        {
            value = v;
            return true;
        }

        value = string.Empty;
        return false;
    }
}
