using System.Net;
using System.Net.Mail;
using Enterprise.Platform.Application.Common.Interfaces;
using Enterprise.Platform.Infrastructure.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Infrastructure.Email;

/// <summary>
/// Binding options for <see cref="SmtpEmailService"/>. Bound from the <c>Smtp</c>
/// configuration section at composition time.
/// </summary>
public sealed class SmtpSettings
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "Smtp";

    /// <summary>SMTP host. When empty, <see cref="SmtpEmailService"/> becomes a no-op (with a warning).</summary>
    public string Host { get; set; } = string.Empty;

    /// <summary>SMTP port. Default 587 (STARTTLS).</summary>
    public int Port { get; set; } = 587;

    /// <summary>When <c>true</c>, TLS is used.</summary>
    public bool EnableSsl { get; set; } = true;

    /// <summary>SMTP auth username. Resolved through user-secrets / Key Vault in non-dev.</summary>
    public string? Username { get; set; }

    /// <summary>SMTP auth password. Resolved through user-secrets / Key Vault in non-dev.</summary>
    public string? Password { get; set; }

    /// <summary>Default <c>From</c> address when the caller doesn't override.</summary>
    public string FromAddress { get; set; } = "noreply@enterprise-platform.local";

    /// <summary>Display name for the default <c>From</c>.</summary>
    public string FromName { get; set; } = "Enterprise Platform";
}

/// <summary>
/// SMTP <see cref="IEmailService"/> — sends mail using <see cref="System.Net.Mail.SmtpClient"/>.
/// Obsolete-but-still-supported in .NET; for high-volume production flows replace with a
/// provider-specific SDK (SendGrid/Mailgun) or an on-host agent.
/// </summary>
public sealed class SmtpEmailService(
    IOptionsMonitor<SmtpSettings> settings,
    ILogger<SmtpEmailService> logger) : IEmailService
{
    private readonly IOptionsMonitor<SmtpSettings> _settings = settings ?? throw new ArgumentNullException(nameof(settings));
    private readonly ILogger<SmtpEmailService> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <inheritdoc />
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(message);

        var opts = _settings.CurrentValue;
        if (string.IsNullOrWhiteSpace(opts.Host))
        {
            _logger.SmtpNotConfigured();
            return;
        }

        using var mail = new MailMessage
        {
            From = new MailAddress(opts.FromAddress, opts.FromName),
            Subject = message.Subject,
            Body = message.Body,
            IsBodyHtml = message.IsHtml,
        };

        foreach (var to in message.To) { mail.To.Add(to); }
        foreach (var cc in message.Cc) { mail.CC.Add(cc); }
        foreach (var bcc in message.Bcc) { mail.Bcc.Add(bcc); }

#pragma warning disable SYSLIB0014 // SmtpClient is obsolete but still the cheapest in-host option.
        using var client = new SmtpClient(opts.Host, opts.Port) { EnableSsl = opts.EnableSsl };
#pragma warning restore SYSLIB0014
        if (!string.IsNullOrWhiteSpace(opts.Username))
        {
            client.Credentials = new NetworkCredential(opts.Username, opts.Password ?? string.Empty);
        }

        await client.SendMailAsync(mail, cancellationToken).ConfigureAwait(false);
    }
}
