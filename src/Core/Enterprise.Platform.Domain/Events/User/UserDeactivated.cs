using Enterprise.Platform.Domain.Events;

namespace Enterprise.Platform.Domain.Events.User;

/// <summary>Raised when an active <see cref="User"/> is deactivated.</summary>
/// <remarks>
/// Deactivation is reversible (see <see cref="UserActivated"/>). For
/// <i>permanent</i> removal use the soft-delete pathway (<c>ISoftDeletable</c>
/// + the soft-delete interceptor) instead.
/// </remarks>
/// <param name="UserId">Identity of the deactivated user.</param>
/// <param name="Reason">Free-form reason recorded at the call site (audit trail).</param>
/// <param name="OccurredOn">UTC timestamp the deactivation committed.</param>
public sealed record UserDeactivated(Guid UserId, string Reason, DateTimeOffset OccurredOn) : IDomainEvent;
