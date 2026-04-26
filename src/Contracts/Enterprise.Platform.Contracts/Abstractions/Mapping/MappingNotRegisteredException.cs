namespace Enterprise.Platform.Contracts.Abstractions.Mapping;

/// <summary>
/// Thrown by <see cref="IMapper"/> implementations when a caller asks to map a
/// type-pair that was never registered with the mapper. The message includes
/// both type names and a pointer to the <c>Add&lt;Db&gt;Mappers</c> call site
/// — most failures are missing-DI registrations, not legitimate code bugs.
/// </summary>
public sealed class MappingNotRegisteredException : InvalidOperationException
{
    /// <summary>Initialises a new <see cref="MappingNotRegisteredException"/>.</summary>
    public MappingNotRegisteredException(Type sourceType, Type destinationType)
        : base(
            $"No mapping registered for {sourceType.FullName} → {destinationType.FullName}. " +
            $"Make sure the relevant Add<Db>Mappers() extension is called during DI setup, " +
            $"and that DtoGen has been run for this entity (see docs/Architecture/DB-First-Workflow.md).")
    {
        SourceType = sourceType;
        DestinationType = destinationType;
    }

    /// <summary>The source type the caller asked to map FROM.</summary>
    public Type SourceType { get; }

    /// <summary>The destination type the caller asked to map TO.</summary>
    public Type DestinationType { get; }
}
