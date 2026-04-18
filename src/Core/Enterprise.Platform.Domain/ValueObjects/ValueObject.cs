namespace Enterprise.Platform.Domain.ValueObjects;

/// <summary>
/// Base class for value objects — immutable types whose identity is the tuple of their
/// components, not an id. Subclasses implement <see cref="GetEqualityComponents"/> to
/// declare which fields participate in equality; <see cref="Equals(object)"/> /
/// <see cref="GetHashCode"/> / operators are derived from that list.
/// </summary>
public abstract class ValueObject : IEquatable<ValueObject>
{
    /// <summary>
    /// Fields that participate in equality. Return them in a stable order — callers
    /// must never depend on runtime-varying order.
    /// </summary>
    protected abstract IEnumerable<object?> GetEqualityComponents();

    /// <inheritdoc />
    public bool Equals(ValueObject? other)
    {
        if (other is null || GetType() != other.GetType())
        {
            return false;
        }

        return GetEqualityComponents().SequenceEqual(other.GetEqualityComponents());
    }

    /// <inheritdoc />
    public override bool Equals(object? obj) => Equals(obj as ValueObject);

    /// <inheritdoc />
    public override int GetHashCode()
    {
        var hash = new HashCode();
        hash.Add(GetType());
        foreach (var component in GetEqualityComponents())
        {
            hash.Add(component);
        }

        return hash.ToHashCode();
    }

    /// <summary>Equality operator — delegates to <see cref="Equals(ValueObject)"/>.</summary>
    public static bool operator ==(ValueObject? left, ValueObject? right)
        => left is null ? right is null : left.Equals(right);

    /// <summary>Negation of <c>operator ==</c>.</summary>
    public static bool operator !=(ValueObject? left, ValueObject? right) => !(left == right);
}
