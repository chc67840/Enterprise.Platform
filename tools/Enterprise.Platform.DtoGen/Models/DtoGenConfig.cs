using System.Text.Json.Serialization;

namespace Enterprise.Platform.DtoGen.Models;

/// <summary>
/// Shape of a per-database <c>configs/&lt;Db&gt;.json</c> file. One config drives
/// one DtoGen run; multiple databases get multiple config files. Paths are repo-
/// root-relative so configs are checked into source control without machine-
/// specific drift.
/// </summary>
public sealed record DtoGenConfig
{
    /// <summary>Logical database name. Used as the registry suffix (e.g. <c>AppMappingRegistry</c>).</summary>
    [JsonPropertyName("databaseName")]
    public required string DatabaseName { get; init; }

    /// <summary>Folder containing scaffolded entity .cs files. Repo-root-relative.</summary>
    [JsonPropertyName("entityRoot")]
    public required string EntityRoot { get; init; }

    /// <summary>
    /// Base-class .cs files whose properties should be flattened into the DTO.
    /// Order doesn't matter — properties are de-duplicated by name.
    /// </summary>
    [JsonPropertyName("baseClassFiles")]
    public IReadOnlyList<string> BaseClassFiles { get; init; } = [];

    /// <summary>Folder where <c>&lt;Entity&gt;Dto.cs</c> files land.</summary>
    [JsonPropertyName("dtoOutput")]
    public required string DtoOutput { get; init; }

    /// <summary>Folder where <c>&lt;Entity&gt;Mappers.cs</c> + <c>&lt;Db&gt;MappingRegistry.cs</c> land.</summary>
    [JsonPropertyName("mapperOutput")]
    public required string MapperOutput { get; init; }

    /// <summary>Namespace declared at the top of every emitted DTO file.</summary>
    [JsonPropertyName("dtoNamespace")]
    public required string DtoNamespace { get; init; }

    /// <summary>Namespace declared at the top of every emitted mapper file.</summary>
    [JsonPropertyName("mapperNamespace")]
    public required string MapperNamespace { get; init; }

    /// <summary>
    /// Column / property names omitted from the generated DTO. Common entries:
    /// <c>RowVersion</c> (concurrency token, opaque to clients).
    /// </summary>
    [JsonPropertyName("skipColumns")]
    public IReadOnlyList<string> SkipColumns { get; init; } = [];

    /// <summary>
    /// File-name globs (matched against the file name only, not path) excluded
    /// when enumerating <see cref="EntityRoot"/>. Common entries:
    /// <c>*.Behavior.cs</c> so partial behaviour files don't get picked up as
    /// separate entities.
    /// </summary>
    [JsonPropertyName("skipFiles")]
    public IReadOnlyList<string> SkipFiles { get; init; } = [];
}
