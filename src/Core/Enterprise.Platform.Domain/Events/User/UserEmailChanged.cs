using Enterprise.Platform.Domain.Events;

namespace Enterprise.Platform.Domain.Events.User;

/// <summary>Raised when <see cref="User.ChangeEmail"/> updates the canonical email.</summary>
/// <remarks>
/// Email is identity-adjacent — downstream side effects often need to react
/// (re-verification, audit, identity-provider sync). Captures both old + new
/// values so listeners don't need to query for the prior state.
/// </remarks>
/// <param name="UserId">Identity of the affected user.</param>
/// <param name="PreviousEmail">Lower-cased prior email.</param>
/// <param name="NewEmail">Lower-cased new email.</param>
/// <param name="OccurredOn">UTC timestamp the change committed.</param>
public sealed record UserEmailChanged(
    Guid UserId,
    string PreviousEmail,
    string NewEmail,
    DateTimeOffset OccurredOn) : IDomainEvent;
