namespace Enterprise.Platform.Web.UI.Controllers.Models;

/// <summary>
/// JSON contract returned by <c>GET /api/auth/me/profile</c>. Surfaces the
/// Microsoft Graph <c>/me</c> shape augmented with a <see cref="Source"/>
/// discriminator so the SPA can distinguish Graph-backed responses from
/// session-claim fallbacks (network failure, Graph-not-consented, etc.).
/// </summary>
/// <param name="Id">Stable Entra object id.</param>
/// <param name="DisplayName">Full display name (Graph-preferred, claim fallback).</param>
/// <param name="GivenName">First name (Graph-only; null on claim fallback).</param>
/// <param name="Surname">Last name (Graph-only; null on claim fallback).</param>
/// <param name="JobTitle">Org-chart job title (Graph-only).</param>
/// <param name="Mail">Primary email (Graph-preferred; falls back to <c>email</c> / <c>preferred_username</c> claim).</param>
/// <param name="UserPrincipalName">UPN (Graph or <c>preferred_username</c> claim).</param>
/// <param name="OfficeLocation">Office building / room (Graph-only).</param>
/// <param name="Department">Department name (Graph-only).</param>
/// <param name="PreferredLanguage">Locale tag (Graph-only).</param>
/// <param name="Source"><c>"graph"</c> when Graph returned data; <c>"claims"</c> for fallback.</param>
public sealed record MeProfileResponse(
    string Id,
    string? DisplayName,
    string? GivenName,
    string? Surname,
    string? JobTitle,
    string? Mail,
    string? UserPrincipalName,
    string? OfficeLocation,
    string? Department,
    string? PreferredLanguage,
    string Source);
