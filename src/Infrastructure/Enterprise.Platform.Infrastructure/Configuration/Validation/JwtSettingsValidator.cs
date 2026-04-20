using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Infrastructure.Configuration.Validation;

/// <summary>
/// Validates <see cref="JwtSettings"/>. When <see cref="JwtSettings.SigningKey"/>
/// is populated it must be at least 32 bytes (256 bits — HMAC-SHA256 minimum).
/// Refresh-token lifetime must exceed access-token lifetime.
/// </summary>
public sealed class JwtSettingsValidator : IValidateOptions<JwtSettings>
{
    private const int MinSigningKeyBytes = 32;

    /// <inheritdoc />
    public ValidateOptionsResult Validate(string? name, JwtSettings options)
    {
        ArgumentNullException.ThrowIfNull(options);

        var errors = new List<string>();

        if (!string.IsNullOrEmpty(options.SigningKey)
            && System.Text.Encoding.UTF8.GetByteCount(options.SigningKey) < MinSigningKeyBytes)
        {
            errors.Add($"Jwt.SigningKey must be at least {MinSigningKeyBytes} bytes (256 bits) for HMAC-SHA256.");
        }

        if (options.AccessTokenLifetime <= TimeSpan.Zero)
        {
            errors.Add("Jwt.AccessTokenLifetime must be > 0.");
        }

        if (options.RefreshTokenLifetime <= options.AccessTokenLifetime)
        {
            errors.Add("Jwt.RefreshTokenLifetime must be greater than AccessTokenLifetime.");
        }

        if (options.ClockSkew < TimeSpan.Zero)
        {
            errors.Add("Jwt.ClockSkew cannot be negative.");
        }

        return errors.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(errors);
    }
}
