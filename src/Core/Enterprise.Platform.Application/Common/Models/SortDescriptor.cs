using Enterprise.Platform.Shared.Enumerations;

namespace Enterprise.Platform.Application.Common.Models;

/// <summary>
/// Single sort selector. Multiple descriptors combine as primary → secondary → tertiary
/// sort order. <see cref="Field"/> must be a property path valid for the target entity
/// (e.g. <c>"CreatedAt"</c>, <c>"Address.City"</c>) — the translator throws on unknown paths.
/// </summary>
public sealed class SortDescriptor
{
    /// <summary>Property path to sort on.</summary>
    public required string Field { get; init; }

    /// <summary>Sort direction. Defaults to <see cref="SortDirection.Asc"/>.</summary>
    public SortDirection Direction { get; init; } = SortDirection.Asc;
}
