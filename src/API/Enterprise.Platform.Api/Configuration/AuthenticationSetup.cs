using System.Text;
using Enterprise.Platform.Contracts.Settings;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace Enterprise.Platform.Api.Configuration;

/// <summary>
/// Configures JWT bearer authentication against <see cref="JwtSettings"/>. **Token
/// issuance is not set up here** — per D4, the refresh-token store lives in
/// PlatformDb which is deferred. The Api validates tokens produced by a future
/// in-platform issuer or an external OIDC provider (e.g. Azure AD) depending on
/// the signing key format.
/// </summary>
public static class AuthenticationSetup
{
    /// <summary>Registers the JWT bearer authentication handler + policy scheme.</summary>
    public static IServiceCollection AddPlatformAuthentication(
        this IServiceCollection services,
        JwtSettings settings)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(settings);

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = !string.IsNullOrWhiteSpace(settings.Issuer),
                    ValidIssuer = settings.Issuer,
                    ValidateAudience = !string.IsNullOrWhiteSpace(settings.Audience),
                    ValidAudience = settings.Audience,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ClockSkew = settings.ClockSkew,
                    IssuerSigningKey = string.IsNullOrWhiteSpace(settings.SigningKey)
                        ? null
                        : new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.SigningKey)),
                };

                // Don't swallow token-validation exceptions — the global exception
                // middleware converts 401s to ProblemDetails for us.
                options.IncludeErrorDetails = false;
            });

        services.AddAuthorization();

        return services;
    }
}
