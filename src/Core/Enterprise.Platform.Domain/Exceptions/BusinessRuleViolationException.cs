using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Domain.Exceptions;

/// <summary>
/// Thrown when a domain invariant or business rule is violated. Maps to HTTP 409 /
/// 422 (depending on the middleware's policy) — the caller can typically correct the
/// input and retry.
/// </summary>
public sealed class BusinessRuleViolationException : DomainException
{
    /// <summary>Initializes the exception with a human-readable rule violation message.</summary>
    public BusinessRuleViolationException(string message)
        : base(ErrorCodes.Conflict, message)
    {
    }

    /// <summary>Initializes the exception wrapping an <paramref name="innerException"/>.</summary>
    public BusinessRuleViolationException(string message, Exception innerException)
        : base(ErrorCodes.Conflict, message, innerException)
    {
    }
}
