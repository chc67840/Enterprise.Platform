namespace Enterprise.Platform.Domain.Exceptions;

/// <summary>
/// Root exception for all domain-rule violations. Carries a stable
/// <see cref="ErrorCode"/> that the global exception middleware maps to an
/// <c>application/problem+json</c> response. Subclasses should be preferred over
/// throwing this directly.
/// </summary>
public abstract class DomainException : Exception
{
    /// <summary>Initializes a domain exception with a stable <paramref name="errorCode"/>.</summary>
    protected DomainException(string errorCode, string message) : base(message)
    {
        ErrorCode = errorCode ?? throw new ArgumentNullException(nameof(errorCode));
    }

    /// <summary>Initializes a domain exception wrapping <paramref name="innerException"/>.</summary>
    protected DomainException(string errorCode, string message, Exception innerException)
        : base(message, innerException)
    {
        ErrorCode = errorCode ?? throw new ArgumentNullException(nameof(errorCode));
    }

    /// <summary>
    /// Stable, machine-readable error code — typically a value from
    /// <c>Shared.Results.ErrorCodes</c>. Clients branch on this instead of parsing
    /// the message.
    /// </summary>
    public string ErrorCode { get; }
}
