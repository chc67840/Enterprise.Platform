namespace Enterprise.Platform.Shared.Extensions;

/// <summary>
/// <see cref="IEnumerable{T}"/> helpers used across Application handlers, validators,
/// and UI adapters. Each helper is lazy where possible and eager where correctness
/// demands it (documented per method).
/// </summary>
public static class EnumerableExtensions
{
    /// <summary>
    /// Eagerly invokes <paramref name="action"/> once per element. Does not yield — use
    /// a plain <c>foreach</c> when you need early termination. Throws when either argument
    /// is <c>null</c>.
    /// </summary>
    public static void ForEach<T>(this IEnumerable<T> source, Action<T> action)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(action);

        foreach (var item in source)
        {
            action(item);
        }
    }

    /// <summary>
    /// Splits <paramref name="source"/> into chunks of up to <paramref name="size"/>
    /// contiguous elements. Thin, named alias over <see cref="Enumerable.Chunk{TSource}(IEnumerable{TSource}, int)"/>
    /// so calling code reads intent (<c>ChunkBy(500)</c> for a batched DB insert, for
    /// example). Lazily evaluated.
    /// </summary>
    public static IEnumerable<IReadOnlyList<T>> ChunkBy<T>(this IEnumerable<T> source, int size)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(size);

        foreach (var chunk in source.Chunk(size))
        {
            yield return chunk;
        }
    }

    /// <summary>
    /// Returns a non-null <see cref="IEnumerable{T}"/> — when <paramref name="source"/> is
    /// <c>null</c>, yields an empty sequence. Useful for gracefully iterating optional
    /// nav-properties and API arrays.
    /// </summary>
    public static IEnumerable<T> OrEmpty<T>(this IEnumerable<T>? source)
        => source ?? [];
}
