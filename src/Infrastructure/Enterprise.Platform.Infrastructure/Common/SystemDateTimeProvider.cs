using Enterprise.Platform.Application.Common.Interfaces;

namespace Enterprise.Platform.Infrastructure.Common;

/// <summary>
/// Default <see cref="IDateTimeProvider"/> — thin wrapper over
/// <see cref="DateTimeOffset.UtcNow"/>. Tests swap in a fake provider to pin time;
/// production always uses this implementation.
/// </summary>
public sealed class SystemDateTimeProvider : IDateTimeProvider
{
    /// <inheritdoc />
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;

    /// <inheritdoc />
    public DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);
}
