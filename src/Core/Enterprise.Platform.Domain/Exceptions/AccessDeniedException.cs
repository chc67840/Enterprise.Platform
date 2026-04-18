using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Domain.Exceptions;

/// <summary>
/// Thrown when a caller is authenticated but lacks the claims/roles required to
/// perform the operation. Maps to HTTP 403. Never throw this when the caller is
/// unauthenticated — that's a 401, produced by the auth middleware instead.
/// </summary>
public sealed class AccessDeniedException : DomainException
{
    /// <summary>Initializes with an explicit message.</summary>
    public AccessDeniedException(string message)
        : base(ErrorCodes.Forbidden, message)
    {
    }

    /// <summary>Convenience constructor — describes the missing permission.</summary>
    public static AccessDeniedException ForPermission(string permission)
        => new($"The current principal lacks the required permission '{permission}'.");
}
