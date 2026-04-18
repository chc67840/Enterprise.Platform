namespace Enterprise.Platform.Application.Common.Interfaces;

/// <summary>
/// Multi-channel user notification dispatch (email, SMS, push, in-app). The
/// implementation fans out to the appropriate provider based on <see cref="NotificationChannel"/>.
/// </summary>
public interface INotificationService
{
    /// <summary>Dispatches a notification to <paramref name="userId"/> via the supplied channels.</summary>
    Task NotifyAsync(
        Guid userId,
        string title,
        string body,
        IReadOnlyList<NotificationChannel> channels,
        CancellationToken cancellationToken = default);
}

/// <summary>Delivery channels supported by <see cref="INotificationService"/>.</summary>
public enum NotificationChannel
{
    /// <summary>In-app notification center.</summary>
    InApp = 0,

    /// <summary>Email — routes through <see cref="IEmailService"/>.</summary>
    Email = 1,

    /// <summary>SMS (stub until an SMS provider is wired).</summary>
    Sms = 2,

    /// <summary>Mobile push (APNs / FCM).</summary>
    Push = 3,
}
