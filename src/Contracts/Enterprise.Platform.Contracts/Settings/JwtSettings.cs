namespace Enterprise.Platform.Contracts.Settings;

/// <summary>
/// JWT issuance + validation settings. <see cref="SigningKey"/> must resolve from a
/// secure source (Azure Key Vault, user-secrets, env var) — never hardcoded and never
/// committed to source.
/// </summary>
public sealed class JwtSettings
{
    /// <summary>Configuration section name — <c>Jwt</c>.</summary>
    public const string SectionName = "Jwt";

    /// <summary>
    /// <c>iss</c> claim — the authority that issues access tokens. Should be a stable
    /// URL (e.g. <c>https://auth.enterprise-platform.local</c>) that identifies this
    /// deployment's identity provider.
    /// </summary>
    public string Issuer { get; set; } = string.Empty;

    /// <summary>
    /// <c>aud</c> claim — the intended audience. The Api validates that incoming tokens
    /// list this value.
    /// </summary>
    public string Audience { get; set; } = string.Empty;

    /// <summary>
    /// HMAC signing key (Base64 or raw). For RS256/ES256 this is unused and the
    /// implementation pulls from <see cref="AzureSettings.KeyVaultUri"/>. Never log.
    /// </summary>
    public string SigningKey { get; set; } = string.Empty;

    /// <summary>
    /// Access-token lifetime. Keep short (default 15 min, per
    /// <c>AppConstants.Auth.AccessTokenMinutes</c>). Longer values widen the replay
    /// window if a token leaks.
    /// </summary>
    public TimeSpan AccessTokenLifetime { get; set; } = TimeSpan.FromMinutes(15);

    /// <summary>
    /// Refresh-token lifetime. Default 14 days. Rotated on every use to limit
    /// stolen-token impact.
    /// </summary>
    public TimeSpan RefreshTokenLifetime { get; set; } = TimeSpan.FromDays(14);

    /// <summary>
    /// Tolerance for clock skew between issuer and validator. Default 30 seconds —
    /// enough to absorb NTP drift without meaningfully extending token lifetime.
    /// </summary>
    public TimeSpan ClockSkew { get; set; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// When <c>true</c>, refresh tokens are rotated on every successful use and the
    /// prior token is revoked. Strongly recommended — the default.
    /// </summary>
    public bool RotateRefreshTokens { get; set; } = true;
}
