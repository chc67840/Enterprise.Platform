using System.Text.Json;
using Enterprise.Platform.DtoGen.Models;
using Enterprise.Platform.DtoGen.Reading;
using Enterprise.Platform.DtoGen.Writing;

namespace Enterprise.Platform.DtoGen;

/// <summary>
/// End-to-end orchestrator for one DtoGen run. Steps:
/// <list type="number">
///   <item>Load <see cref="DtoGenConfig"/> from <c>configs/&lt;Db&gt;.json</c>.</item>
///   <item>Parse base classes into a name → properties lookup.</item>
///   <item>Enumerate entity files (skip the <see cref="DtoGenConfig.SkipFiles"/> globs).</item>
///   <item>For each entity: read shape, emit DTO, emit per-entity Mapper.</item>
///   <item>Emit one <c>&lt;Db&gt;MappingRegistry.cs</c> with all type-pair registrations.</item>
/// </list>
/// </summary>
internal sealed class Generator(string repoRoot)
{
    private readonly string _repoRoot = repoRoot;

    public async Task<int> RunAsync(string configFilePath, bool dryRun, CancellationToken cancellationToken)
    {
        var configFullPath = Path.IsPathRooted(configFilePath)
            ? configFilePath
            : Path.Combine(AppContext.BaseDirectory, configFilePath);
        if (!File.Exists(configFullPath))
        {
            Console.Error.WriteLine($"FATAL: config file not found: {configFullPath}");
            return 1;
        }

        var config = await LoadConfigAsync(configFullPath, cancellationToken).ConfigureAwait(false);

        var entityRootAbs = ResolvePath(config.EntityRoot);
        var dtoOutAbs = ResolvePath(config.DtoOutput);
        var mapperOutAbs = ResolvePath(config.MapperOutput);
        var baseFilesAbs = config.BaseClassFiles.Select(ResolvePath).ToList();

        if (!Directory.Exists(entityRootAbs))
        {
            Console.Error.WriteLine($"FATAL: entity root does not exist: {entityRootAbs}");
            return 1;
        }

        // Discover entity files. Skip-globs match against the file name only.
        var entityFiles = Directory
            .EnumerateFiles(entityRootAbs, "*.cs", SearchOption.TopDirectoryOnly)
            .Where(p => !MatchesAnySkipGlob(Path.GetFileName(p), config.SkipFiles))
            .OrderBy(p => p, StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (entityFiles.Count == 0)
        {
            Console.Error.WriteLine($"WARNING: no entity files matched in {entityRootAbs} (after skip-globs).");
            return 0;
        }

        Console.WriteLine($"DtoGen — database '{config.DatabaseName}'");
        Console.WriteLine($"  entity root : {entityRootAbs}");
        Console.WriteLine($"  base files  : {baseFilesAbs.Count}");
        Console.WriteLine($"  entities    : {entityFiles.Count}");
        Console.WriteLine($"  dto output  : {dtoOutAbs}");
        Console.WriteLine($"  mapper out  : {mapperOutAbs}");
        if (dryRun) Console.WriteLine("  DRY RUN — no files will be written.");

        var baseClassLookup = await BaseClassReader.ReadAsync(baseFilesAbs, config.SkipColumns, cancellationToken).ConfigureAwait(false);

        if (!dryRun)
        {
            Directory.CreateDirectory(dtoOutAbs);
            Directory.CreateDirectory(mapperOutAbs);
        }

        var entities = new List<EntityDescriptor>(entityFiles.Count);
        var entityNamespaces = new HashSet<string>(StringComparer.Ordinal);

        foreach (var file in entityFiles)
        {
            var descriptor = await EntityReader.ReadAsync(file, baseClassLookup, config.SkipColumns, cancellationToken).ConfigureAwait(false);
            if (descriptor is null)
            {
                Console.WriteLine($"  skip       : {Path.GetFileName(file)} (no class declaration)");
                continue;
            }

            entities.Add(descriptor);
            entityNamespaces.Add(descriptor.Namespace);

            // ── DTO ────────────────────────────────────────────────────────
            var dtoText = DtoEmitter.Emit(descriptor, config.DtoNamespace);
            var dtoPath = Path.Combine(dtoOutAbs, descriptor.ClassName + "Dto.cs");
            if (!dryRun)
            {
                await File.WriteAllTextAsync(dtoPath, dtoText, cancellationToken).ConfigureAwait(false);
            }
            Console.WriteLine($"  wrote DTO  : {RelativeToRepo(dtoPath)} ({descriptor.Properties.Count} props)");

            // ── Mapper ─────────────────────────────────────────────────────
            var mapperText = MapperEmitter.Emit(descriptor, descriptor.Namespace, config.DtoNamespace, config.MapperNamespace);
            var mapperPath = Path.Combine(mapperOutAbs, descriptor.ClassName + "Mappers.cs");
            if (!dryRun)
            {
                await File.WriteAllTextAsync(mapperPath, mapperText, cancellationToken).ConfigureAwait(false);
            }
            Console.WriteLine($"  wrote map  : {RelativeToRepo(mapperPath)}");
        }

        // ── Registry ──────────────────────────────────────────────────────
        // RegistryEmitter takes a single entityNamespace because in practice every
        // entity in one database lives in the same Persistence/<Db>/Entities
        // namespace. If that ever changes, switch to passing the full set.
        var primaryNamespace = entityNamespaces.Count == 1
            ? entityNamespaces.First()
            : throw new InvalidOperationException(
                $"Entities span {entityNamespaces.Count} namespaces — RegistryEmitter assumes one. " +
                $"Namespaces seen: {string.Join(", ", entityNamespaces)}");

        var registryText = RegistryEmitter.Emit(entities, config.DatabaseName, primaryNamespace, config.DtoNamespace, config.MapperNamespace);
        var registryPath = Path.Combine(mapperOutAbs, config.DatabaseName + "MappingRegistry.cs");
        if (!dryRun)
        {
            await File.WriteAllTextAsync(registryPath, registryText, cancellationToken).ConfigureAwait(false);
        }
        Console.WriteLine($"  wrote reg  : {RelativeToRepo(registryPath)} ({entities.Count} entries)");

        Console.WriteLine($"Done — {entities.Count} entity/DTO pairs.");
        return 0;
    }

    private static readonly JsonSerializerOptions ConfigJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
    };

    private static async Task<DtoGenConfig> LoadConfigAsync(string path, CancellationToken cancellationToken)
    {
        await using var stream = File.OpenRead(path);
        var config = await JsonSerializer.DeserializeAsync<DtoGenConfig>(stream, ConfigJsonOptions, cancellationToken).ConfigureAwait(false);
        if (config is null)
        {
            throw new InvalidOperationException($"Config at {path} deserialised to null.");
        }
        return config;
    }

    private string ResolvePath(string repoRelative)
        => Path.IsPathRooted(repoRelative) ? repoRelative : Path.GetFullPath(Path.Combine(_repoRoot, repoRelative));

    private string RelativeToRepo(string absolute)
    {
        var rel = Path.GetRelativePath(_repoRoot, absolute);
        return rel.Replace('\\', '/');
    }

    private static bool MatchesAnySkipGlob(string fileName, IReadOnlyList<string> globs)
    {
        foreach (var glob in globs)
        {
            // Only support trailing-suffix wildcards (`*.Behavior.cs`) — anything more
            // complex belongs in a real glob library (we have no third-party deps).
            if (glob.StartsWith('*'))
            {
                var suffix = glob[1..];
                if (fileName.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            else if (string.Equals(fileName, glob, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }
}
