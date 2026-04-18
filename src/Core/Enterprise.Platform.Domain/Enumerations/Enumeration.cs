using System.Reflection;

namespace Enterprise.Platform.Domain.Enumerations;

/// <summary>
/// Smart-enum base class — an alternative to <c>enum</c> when values need behaviour
/// (methods), stable string names, or richer payloads. Subclasses declare
/// <c>public static readonly</c> instances; <see cref="GetAll{T}"/> reflects over the
/// type to enumerate them.
/// </summary>
public abstract class Enumeration : IComparable, IEquatable<Enumeration>
{
    /// <summary>Initializes an enumeration member.</summary>
    protected Enumeration(int id, string name)
    {
        Id = id;
        Name = name ?? throw new ArgumentNullException(nameof(name));
    }

    /// <summary>Stable integer id — typically persisted to the database.</summary>
    public int Id { get; }

    /// <summary>Stable display name — used for serialization and logging.</summary>
    public string Name { get; }

    /// <summary>Returns the <see cref="Name"/> for debug/log convenience.</summary>
    public override string ToString() => Name;

    /// <summary>
    /// Enumerates every <c>public static readonly</c> instance declared on
    /// <typeparamref name="T"/>. Reflection-based — call infrequently or cache the result
    /// in hot paths.
    /// </summary>
    public static IEnumerable<T> GetAll<T>() where T : Enumeration
        => typeof(T)
            .GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly)
            .Where(f => typeof(T).IsAssignableFrom(f.FieldType))
            .Select(f => (T)f.GetValue(null)!);

    /// <summary>Looks up an enumeration member by its <see cref="Id"/>.</summary>
    /// <exception cref="InvalidOperationException">No member with that id exists.</exception>
    public static T FromId<T>(int id) where T : Enumeration
        => GetAll<T>().FirstOrDefault(e => e.Id == id)
           ?? throw new InvalidOperationException(
               $"No {typeof(T).Name} with Id={id} is defined.");

    /// <summary>Looks up an enumeration member by its <see cref="Name"/> (ordinal compare).</summary>
    /// <exception cref="InvalidOperationException">No member with that name exists.</exception>
    public static T FromName<T>(string name) where T : Enumeration
        => GetAll<T>().FirstOrDefault(e => string.Equals(e.Name, name, StringComparison.Ordinal))
           ?? throw new InvalidOperationException(
               $"No {typeof(T).Name} with Name='{name}' is defined.");

    /// <inheritdoc />
    public bool Equals(Enumeration? other)
        => other is not null && GetType() == other.GetType() && Id == other.Id;

    /// <inheritdoc />
    public override bool Equals(object? obj) => Equals(obj as Enumeration);

    /// <inheritdoc />
    public override int GetHashCode() => HashCode.Combine(GetType(), Id);

    /// <inheritdoc />
    public int CompareTo(object? obj)
        => obj is Enumeration other
            ? Id.CompareTo(other.Id)
            : throw new ArgumentException("Cannot compare to null or different type.", nameof(obj));

    /// <summary>Equality operator — delegates to <see cref="Equals(Enumeration)"/>.</summary>
    public static bool operator ==(Enumeration? left, Enumeration? right)
        => left is null ? right is null : left.Equals(right);

    /// <summary>Negation of <c>operator ==</c>.</summary>
    public static bool operator !=(Enumeration? left, Enumeration? right) => !(left == right);

    /// <summary>Less-than operator — ordered by <see cref="Id"/>.</summary>
    public static bool operator <(Enumeration? left, Enumeration? right)
        => left is null ? right is not null : left.CompareTo(right) < 0;

    /// <summary>Less-than-or-equal operator.</summary>
    public static bool operator <=(Enumeration? left, Enumeration? right)
        => left is null || left.CompareTo(right) <= 0;

    /// <summary>Greater-than operator.</summary>
    public static bool operator >(Enumeration? left, Enumeration? right)
        => left is not null && left.CompareTo(right) > 0;

    /// <summary>Greater-than-or-equal operator.</summary>
    public static bool operator >=(Enumeration? left, Enumeration? right)
        => left is null ? right is null : left.CompareTo(right) >= 0;
}
