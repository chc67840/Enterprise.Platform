namespace Enterprise.Platform.Web.UI.Services.Graph;

/// <summary>
/// Microsoft Graph endpoint URLs and scope strings used by the Web.UI host.
/// Centralised so a Graph-API change (sovereign-cloud endpoint, scope rename,
/// API version bump) lands in one place.
/// </summary>
public static class GraphConstants
{
    /// <summary>
    /// Microsoft Graph delegated scope required to read the signed-in user's
    /// own profile via <see cref="MeEndpoint"/>.
    /// </summary>
    public const string UserReadScope = "https://graph.microsoft.com/User.Read";

    /// <summary>
    /// Microsoft Graph <c>/me</c> URL with a <c>$select</c> projection that
    /// keeps the wire payload narrow (we only consume what
    /// <c>GraphUserProfile</c> models). Pinning the select clause here
    /// prevents accidental field-bloat as Graph evolves.
    /// </summary>
    public const string MeEndpoint =
        "https://graph.microsoft.com/v1.0/me?$select=id,displayName,givenName,surname,jobTitle,mail,userPrincipalName,officeLocation,department,preferredLanguage";
}
