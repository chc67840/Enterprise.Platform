namespace Enterprise.Platform.Contracts.Abstractions.Mapping;

/// <summary>
/// Mutable builder shape consumed by every generated <c>Add&lt;Db&gt;Mappers</c>
/// extension. Each generator output calls <see cref="Register{TSource, TDestination}"/>
/// once per entity ↔ DTO pair; the resulting dictionary is then handed to a
/// <see cref="DictionaryMapper"/> which IMapper consumers see.
/// </summary>
/// <remarks>
/// Designed so a host can layer multiple databases' mappers into a single
/// <see cref="IMapper"/>: <c>builder.AddAppMappers().AddPlatformMappers()</c>
/// works because both extensions append to the same builder instance before
/// the final <see cref="Build"/> call.
/// </remarks>
public sealed class MapperRegistry
{
    private readonly Dictionary<(Type Source, Type Destination), Func<object, object>> _maps = [];

    /// <summary>Registers a strongly-typed mapping function. Last write wins on duplicates.</summary>
    public MapperRegistry Register<TSource, TDestination>(Func<TSource, TDestination> map)
        where TSource : notnull
        where TDestination : notnull
    {
        ArgumentNullException.ThrowIfNull(map);
        _maps[(typeof(TSource), typeof(TDestination))] = src => map((TSource)src);
        return this;
    }

    /// <summary>Materialises the configured registry into an immutable <see cref="IMapper"/>.</summary>
    public IMapper Build() => new DictionaryMapper(_maps);
}

/// <summary>
/// Default <see cref="IMapper"/> implementation. Pure dictionary lookup —
/// no reflection, no convention scan, no third-party runtime dependency.
/// </summary>
internal sealed class DictionaryMapper : IMapper
{
    private readonly IReadOnlyDictionary<(Type Source, Type Destination), Func<object, object>> _maps;

    public DictionaryMapper(IReadOnlyDictionary<(Type Source, Type Destination), Func<object, object>> maps)
    {
        _maps = maps ?? throw new ArgumentNullException(nameof(maps));
    }

    /// <inheritdoc />
    public TDestination Map<TSource, TDestination>(TSource source) where TSource : notnull
    {
        ArgumentNullException.ThrowIfNull(source);
        if (!_maps.TryGetValue((typeof(TSource), typeof(TDestination)), out var map))
        {
            throw new MappingNotRegisteredException(typeof(TSource), typeof(TDestination));
        }
        return (TDestination)map(source);
    }

    /// <inheritdoc />
    public object Map(object source, Type destinationType)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(destinationType);
        // Use the runtime type so polymorphic callers (e.g. List<Entity> projected as
        // IEnumerable<object>) still find the right mapper.
        var sourceType = source.GetType();
        if (!_maps.TryGetValue((sourceType, destinationType), out var map))
        {
            throw new MappingNotRegisteredException(sourceType, destinationType);
        }
        return map(source);
    }
}
