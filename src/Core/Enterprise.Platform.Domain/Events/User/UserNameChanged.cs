using Enterprise.Platform.Domain.Events;

namespace Enterprise.Platform.Domain.Events.User;

/// <summary>Raised when <see cref="User.Rename"/> changes the person's name.</summary>
/// <param name="UserId">Identity of the user whose name changed.</param>
/// <param name="PreviousDisplayName">Display form of the prior name (audit trail).</param>
/// <param name="NewDisplayName">Display form of the new name.</param>
/// <param name="OccurredOn">UTC timestamp the rename committed.</param>
public sealed record UserNameChanged(
    Guid UserId,
    string PreviousDisplayName,
    string NewDisplayName,
    DateTimeOffset OccurredOn) : IDomainEvent;
