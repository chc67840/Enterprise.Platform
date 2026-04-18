namespace Enterprise.Platform.Domain.Interfaces;

/// <summary>
/// Contract for entities that support logical (soft) deletion. Infrastructure applies
/// a global query filter so <see cref="IsDeleted"/>==<c>true</c> rows are invisible to
/// normal reads; <c>SoftDeleteInterceptor</c> intercepts <c>Remove</c> calls and flips
/// the flag instead of emitting SQL <c>DELETE</c>.
/// </summary>
public interface ISoftDeletable
{
    /// <summary><c>true</c> once the row has been logically deleted.</summary>
    bool IsDeleted { get; set; }

    /// <summary>UTC timestamp of the deletion. <c>null</c> when <see cref="IsDeleted"/> is <c>false</c>.</summary>
    DateTimeOffset? DeletedAt { get; set; }

    /// <summary>User id that performed the deletion.</summary>
    string? DeletedBy { get; set; }
}
