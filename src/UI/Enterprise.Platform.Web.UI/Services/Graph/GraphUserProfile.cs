using System.Text.Json.Serialization;

namespace Enterprise.Platform.Web.UI.Services.Graph;

/// <summary>
/// Microsoft Graph <c>/me</c> projection — the subset of fields the host
/// surfaces to the SPA. Property names use the Graph wire shape (camelCase)
/// for direct deserialization.
/// </summary>
/// <param name="Id">Stable Entra object id.</param>
/// <param name="DisplayName">Full display name.</param>
/// <param name="GivenName">First name (may be null).</param>
/// <param name="Surname">Last name (may be null).</param>
/// <param name="JobTitle">Org-chart job title.</param>
/// <param name="Mail">Primary email; <c>null</c> when not configured.</param>
/// <param name="UserPrincipalName">UPN — typically the sign-in identifier.</param>
/// <param name="OfficeLocation">Office building / room.</param>
/// <param name="Department">Department name.</param>
/// <param name="PreferredLanguage">Locale tag (e.g. <c>en-US</c>).</param>
public sealed record GraphUserProfile(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("displayName")] string? DisplayName,
    [property: JsonPropertyName("givenName")] string? GivenName,
    [property: JsonPropertyName("surname")] string? Surname,
    [property: JsonPropertyName("jobTitle")] string? JobTitle,
    [property: JsonPropertyName("mail")] string? Mail,
    [property: JsonPropertyName("userPrincipalName")] string? UserPrincipalName,
    [property: JsonPropertyName("officeLocation")] string? OfficeLocation,
    [property: JsonPropertyName("department")] string? Department,
    [property: JsonPropertyName("preferredLanguage")] string? PreferredLanguage);
