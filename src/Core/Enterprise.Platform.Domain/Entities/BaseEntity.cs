namespace Enterprise.Platform.Domain.Entities;

/// <summary>
/// Root of the entity hierarchy. Provides an identity (<see cref="Id"/>) and an
/// optimistic-concurrency token (<see cref="RowVersion"/>) — every persisted entity
/// derives from this directly or transitively. The <see cref="Id"/> setter is
/// <c>protected</c> so EF Core can bind via reflection while application code cannot
/// reassign identity after construction.
/// </summary>
public abstract class BaseEntity : IEquatable<BaseEntity>
{
    /// <summary>
    /// Initializes a new entity with a fresh <see cref="Guid"/> identity. Subclasses
    /// may override via a protected constructor that accepts a pre-assigned id (for
    /// replayed events / tests).
    /// </summary>
    protected BaseEntity()
    {
        Id = Guid.NewGuid();
    }

    /// <summary>Stable identity of the entity. Set once at construction.</summary>
    public Guid Id { get; protected set; }

    /// <summary>
    /// Row-version token used for optimistic concurrency control. Populated and
    /// validated by EF Core on every <c>SaveChangesAsync</c> — a mismatch raises
    /// <see cref="Domain.Exceptions.ConcurrencyConflictException"/> via the
    /// infrastructure translator.
    /// </summary>
    public byte[] RowVersion { get; set; } = [];

    /// <inheritdoc />
    public bool Equals(BaseEntity? other)
        => other is not null && GetType() == other.GetType() && Id == other.Id;

    /// <inheritdoc />
    public override bool Equals(object? obj) => Equals(obj as BaseEntity);

    /// <inheritdoc />
    public override int GetHashCode() => HashCode.Combine(GetType(), Id);

    /// <summary>Two entities are equal when they are of the same concrete type and share an <see cref="Id"/>.</summary>
    public static bool operator ==(BaseEntity? left, BaseEntity? right)
        => left is null ? right is null : left.Equals(right);

    /// <summary>Negation of <c>operator ==</c>.</summary>
    public static bool operator !=(BaseEntity? left, BaseEntity? right) => !(left == right);
}
