using System.Text.Json.Serialization;

namespace Enterprise.Platform.Web.UI.Services.Authentication;

/// <summary>
/// JSON shape returned by Entra's <c>POST /oauth2/v2.0/token</c> endpoint.
/// Shared between <see cref="TokenRefreshService"/> (rotates the API-scoped
/// access token) and <c>GraphUserProfileService</c> (mints a Graph-scoped
/// token from the same refresh token). Only the fields we consume are
/// modeled — Entra includes several extras we ignore.
/// </summary>
public sealed record EntraTokenResponse
{
    /// <summary>The freshly-minted access token.</summary>
    [JsonPropertyName("access_token")]
    public string AccessToken { get; init; } = string.Empty;

    /// <summary>
    /// The new refresh token (Entra rotates them on every grant). May be
    /// absent on some grants — callers retain the previous refresh token
    /// when this is null/empty.
    /// </summary>
    [JsonPropertyName("refresh_token")]
    public string? RefreshToken { get; init; }

    /// <summary>The new id token (issued for OIDC grants).</summary>
    [JsonPropertyName("id_token")]
    public string? IdToken { get; init; }

    /// <summary>Lifetime of <see cref="AccessToken"/> in seconds.</summary>
    [JsonPropertyName("expires_in")]
    public int ExpiresIn { get; init; }

    /// <summary>Token type — typically <c>"Bearer"</c>.</summary>
    [JsonPropertyName("token_type")]
    public string TokenType { get; init; } = string.Empty;
}
