namespace Enterprise.Platform.Web.UI.Controllers.Models;

/// <summary>
/// JSON shape returned by <c>GET /api/auth/session</c>. Deliberately minimal —
/// the SPA never needs more than this to render name/badge/roles + drive the
/// expiry-warning clock.
/// </summary>
/// <param name="IsAuthenticated">Whether a valid host session cookie backs this request.</param>
/// <param name="Name">Display name (<c>name</c> claim), or <c>null</c> anonymous.</param>
/// <param name="Email">Contact email — tries <c>email</c>, <c>preferred_username</c>, then the schema URL claim.</param>
/// <param name="Roles">Distinct app-role values. Empty when none assigned; never <c>null</c>.</param>
/// <param name="ExpiresAt">Cookie expiration instant used by <c>SessionMonitorService</c>.</param>
public sealed record SessionInfo(
    bool IsAuthenticated,
    string? Name,
    string? Email,
    IReadOnlyList<string> Roles,
    DateTimeOffset? ExpiresAt)
{
    /// <summary>Singleton returned when <c>User.Identity.IsAuthenticated</c> is false.</summary>
    public static SessionInfo Anonymous { get; } = new(
        IsAuthenticated: false,
        Name: null,
        Email: null,
        Roles: Array.Empty<string>(),
        ExpiresAt: null);
}
