namespace Enterprise.Platform.Web.UI.Configuration;

/// <summary>
/// Settings for the BFF → Api reverse proxy. Bound from the <c>Bff:Proxy</c>
/// configuration section.
/// </summary>
public sealed class BffProxySettings
{
    /// <summary>Configuration section name — <c>Bff:Proxy</c>.</summary>
    public const string SectionName = "Bff:Proxy";

    /// <summary>
    /// Downstream Api base URI (e.g. <c>https://localhost:7099/</c>). All
    /// <c>/api/proxy/...</c> paths are rewritten to <see cref="ApiBaseUri"/>
    /// + the remainder of the path.
    /// </summary>
    public string ApiBaseUri { get; set; } = "http://localhost:5099/";

    /// <summary>Per-request timeout on the downstream call.</summary>
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// When <c>true</c>, the proxy forwards the user's access-token as a
    /// <c>Bearer</c> on the downstream call. Cookie-backed token storage is
    /// part of the deferred OIDC flow; set <c>false</c> in dev when no token
    /// is attached to the session.
    /// </summary>
    public bool AttachBearerToken { get; set; }
}
