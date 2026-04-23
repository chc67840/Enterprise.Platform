namespace Enterprise.Platform.Web.UI.Configuration;

/// <summary>
/// Settings for the Web.UI → Api reverse proxy. Bound from the
/// <c>Proxy</c> configuration section.
/// </summary>
public sealed class ProxySettings
{
    /// <summary>Configuration section name — <c>Proxy</c>.</summary>
    public const string SectionName = "Proxy";

    /// <summary>
    /// Downstream Api base URI (e.g. <c>http://localhost:5044/api/</c>).
    /// MUST include the path prefix the downstream Api lives under
    /// (typically <c>/api/</c>). All <c>/api/proxy/...</c> paths are
    /// rewritten to <see cref="ApiBaseUri"/> + the remainder of the path —
    /// missing the path prefix produces 404s from the downstream Api.
    /// </summary>
    public string ApiBaseUri { get; set; } = "http://localhost:5099/";

    /// <summary>Per-request timeout on the downstream call.</summary>
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// When <c>true</c>, the proxy forwards the user's access-token as a
    /// <c>Bearer</c> on the downstream call. The token is read from the
    /// session cookie ticket via <c>HttpContext.GetTokenAsync("access_token")</c>;
    /// set <c>false</c> only in cookie-only-session test scenarios.
    /// </summary>
    public bool AttachBearerToken { get; set; }
}
