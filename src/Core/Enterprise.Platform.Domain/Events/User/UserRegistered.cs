using Enterprise.Platform.Domain.Events;

namespace Enterprise.Platform.Domain.Events.User;

/// <summary>
/// Raised the moment a new <see cref="User"/> aggregate is constructed via
/// <see cref="User.Register"/>. Subscribers in the same bounded context can
/// react synchronously (in-process dispatcher) once <c>SaveChangesAsync</c>
/// commits — for example, sending a welcome email or seeding default
/// per-user settings.
/// </summary>
/// <param name="UserId">Identity of the freshly-registered user.</param>
/// <param name="Email">Lower-cased canonical email.</param>
/// <param name="OccurredOn">UTC timestamp the registration completed.</param>
public sealed record UserRegistered(Guid UserId, string Email, DateTimeOffset OccurredOn) : IDomainEvent;
