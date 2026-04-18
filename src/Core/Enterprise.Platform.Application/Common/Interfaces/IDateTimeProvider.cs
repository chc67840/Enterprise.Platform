namespace Enterprise.Platform.Application.Common.Interfaces;

/// <summary>
/// Abstraction over <see cref="DateTime"/> and <see cref="DateTimeOffset"/>. Handlers,
/// behaviors, and value-objects depend on this instead of the static <see cref="DateTime.UtcNow"/>
/// so tests can pin time deterministically. Infrastructure supplies the default
/// <c>SystemDateTimeProvider</c> implementation.
/// </summary>
public interface IDateTimeProvider
{
    /// <summary>Current UTC instant.</summary>
    DateTimeOffset UtcNow { get; }

    /// <summary>UTC today (date component, time at midnight).</summary>
    DateOnly Today { get; }
}
