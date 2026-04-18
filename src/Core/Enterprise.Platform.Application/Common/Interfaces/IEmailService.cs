namespace Enterprise.Platform.Application.Common.Interfaces;

/// <summary>
/// Outbound email abstraction. Infrastructure: <c>SmtpEmailService</c> (default),
/// <c>SendGridEmailService</c> (stub). Handlers never call the email provider
/// directly — they hand off a <see cref="EmailMessage"/> and rely on the provider's
/// retry policy for transient failures.
/// </summary>
public interface IEmailService
{
    /// <summary>Sends <paramref name="message"/>. Throws on non-transient failures.</summary>
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}

/// <summary>
/// Immutable email payload. PII-containing fields (recipients, subject, body) should
/// be produced from sanitized inputs; the infrastructure emailer logs only metadata.
/// </summary>
public sealed class EmailMessage
{
    /// <summary>Recipient addresses (To).</summary>
    public required IReadOnlyList<string> To { get; init; }

    /// <summary>Carbon-copy addresses. Empty by default.</summary>
    public IReadOnlyList<string> Cc { get; init; } = [];

    /// <summary>Blind-carbon-copy addresses. Empty by default.</summary>
    public IReadOnlyList<string> Bcc { get; init; } = [];

    /// <summary>Subject line. Keep short; most clients truncate.</summary>
    public required string Subject { get; init; }

    /// <summary>Body content. HTML when <see cref="IsHtml"/> is <c>true</c>; otherwise plain text.</summary>
    public required string Body { get; init; }

    /// <summary>When <c>true</c>, the body is treated as HTML. Default <c>true</c>.</summary>
    public bool IsHtml { get; init; } = true;

    /// <summary>Optional template id — infrastructure may substitute a rendered template when populated.</summary>
    public string? TemplateId { get; init; }

    /// <summary>Optional template data for substitution.</summary>
    public IReadOnlyDictionary<string, string>? TemplateData { get; init; }
}
