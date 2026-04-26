namespace Enterprise.Platform.DtoGen.Models;

/// <summary>
/// Parsed shape of a scaffolded entity. Produced by <see cref="Reading.EntityReader"/>;
/// consumed by every emitter. Properties are the union of the entity's own
/// declarations + every declared base-class's declarations (skip rules already
/// applied at construction time).
/// </summary>
public sealed record EntityDescriptor(
    string ClassName,
    string Namespace,
    string? BaseClassName,
    IReadOnlyList<PropertyDescriptor> Properties);

/// <summary>
/// One property on an entity (own or inherited). Carries enough type info for the
/// emitter to declare a matching DTO record parameter without ambiguity.
/// </summary>
public sealed record PropertyDescriptor(
    string Name,
    string TypeText,
    bool IsInherited);
