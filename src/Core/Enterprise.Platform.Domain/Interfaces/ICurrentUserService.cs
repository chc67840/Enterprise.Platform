namespace Enterprise.Platform.Domain.Interfaces;

/// <summary>
/// Ambient information about the authenticated caller. Populated from the current
/// <c>HttpContext</c>'s principal by <c>CurrentUserService</c> and injected into
/// handlers, interceptors, and audit writers. All properties are safe to read even
/// on anonymous requests (<see cref="IsAuthenticated"/>==<c>false</c>).
/// </summary>
public interface ICurrentUserService
{
    /// <summary>Authenticated user id. <c>null</c> on anonymous requests.</summary>
    Guid? UserId { get; }

    /// <summary>Authenticated user's email. <c>null</c> on anonymous requests.</summary>
    string? Email { get; }

    /// <summary><c>true</c> when the request carries a validated principal.</summary>
    bool IsAuthenticated { get; }

    /// <summary>Returns <c>true</c> when the principal has the named permission claim.</summary>
    bool HasPermission(string permission);

    /// <summary>Returns <c>true</c> when the principal is in the named role.</summary>
    bool IsInRole(string role);
}
