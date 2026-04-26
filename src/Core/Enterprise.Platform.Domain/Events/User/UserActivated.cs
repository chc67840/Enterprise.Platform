using Enterprise.Platform.Domain.Events;

namespace Enterprise.Platform.Domain.Events.User;

/// <summary>Raised when a previously-deactivated <see cref="User"/> is reactivated.</summary>
public sealed record UserActivated(Guid UserId, DateTimeOffset OccurredOn) : IDomainEvent;
