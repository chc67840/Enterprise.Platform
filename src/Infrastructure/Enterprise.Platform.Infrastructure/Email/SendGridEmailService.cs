using Enterprise.Platform.Application.Common.Interfaces;

namespace Enterprise.Platform.Infrastructure.Email;

/// <summary>
/// <b>Placeholder.</b> SendGrid-backed <see cref="IEmailService"/>. Activated when the
/// platform needs higher-deliverability transactional email than
/// <see cref="SmtpEmailService"/>. Add the <c>SendGrid</c> NuGet + configure
/// <c>SendGridSettings.ApiKey</c> (Key Vault / user-secrets) before wiring.
/// </summary>
public sealed class SendGridEmailService : IEmailService
{
    /// <inheritdoc />
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
        => throw new NotSupportedException("SendGridEmailService is a placeholder — add SendGrid NuGet + API key before wiring.");
}
