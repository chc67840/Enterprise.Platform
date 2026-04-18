namespace Enterprise.Platform.Contracts.Settings;

/// <summary>
/// Cross-Origin Resource Sharing (CORS) policy. The Api uses these values to build a
/// single named policy that the BFF and any first-party SPAs share. <b>Never use
/// <c>"*"</c> for <see cref="AllowedOrigins"/></b> when <see cref="AllowCredentials"/>
/// is true — the browser will reject the response.
/// </summary>
public sealed class CorsSettings
{
    /// <summary>Configuration section name — <c>Cors</c>.</summary>
    public const string SectionName = "Cors";

    /// <summary>
    /// Origins permitted to call the Api. Compared exact-match (scheme + host + port).
    /// Use <c>https://web.enterprise-platform.local</c> shape — never omit scheme.
    /// </summary>
    public IReadOnlyList<string> AllowedOrigins { get; set; } = [];

    /// <summary>
    /// HTTP methods permitted by the policy. Default covers the typical REST verbs;
    /// narrow per environment if needed.
    /// </summary>
    public IReadOnlyList<string> AllowedMethods { get; set; } =
        ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

    /// <summary>
    /// Headers clients may send. The platform's custom headers (correlation, tenant,
    /// idempotency) must appear here for the browser to forward them.
    /// </summary>
    public IReadOnlyList<string> AllowedHeaders { get; set; } =
        ["Content-Type", "Authorization", "X-Correlation-ID", "X-Tenant-ID", "X-Idempotency-Key", "X-API-Version"];

    /// <summary>
    /// Headers the browser is allowed to read from responses. Add anything the client
    /// needs beyond the CORS-safelisted set (e.g. <c>X-Correlation-ID</c> for diagnostics).
    /// </summary>
    public IReadOnlyList<string> ExposedHeaders { get; set; } = ["X-Correlation-ID"];

    /// <summary>
    /// When <c>true</c>, the browser sends cookies/<c>Authorization</c> headers with
    /// cross-origin requests. Required for the BFF cookie-session model.
    /// </summary>
    public bool AllowCredentials { get; set; } = true;

    /// <summary>
    /// Preflight cache duration. Longer values reduce OPTIONS chatter but delay policy
    /// rollouts; default 10 minutes.
    /// </summary>
    public TimeSpan PreflightMaxAge { get; set; } = TimeSpan.FromMinutes(10);
}
