using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Infrastructure.Configuration.Validation;

/// <summary>
/// Validates <see cref="EntraIdSettings"/>. When Enabled is <c>true</c>, ClientId
/// and Instance become required. Multi-tenant configurations (TenantId =
/// <c>"common"</c> / <c>"organizations"</c>) additionally require at least one
/// entry in <see cref="EntraIdSettings.AllowedIssuers"/> — without it, tokens from
/// any Microsoft tenant would be accepted.
/// </summary>
public sealed class EntraIdSettingsValidator : IValidateOptions<EntraIdSettings>
{
    /// <inheritdoc />
    public ValidateOptionsResult Validate(string? name, EntraIdSettings options)
    {
        ArgumentNullException.ThrowIfNull(options);

        if (!options.Enabled)
        {
            return ValidateOptionsResult.Success;
        }

        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(options.ClientId))
        {
            errors.Add("AzureAd.ClientId is required when AzureAd.Enabled is true.");
        }

        if (string.IsNullOrWhiteSpace(options.Instance) || !Uri.IsWellFormedUriString(options.Instance, UriKind.Absolute))
        {
            errors.Add("AzureAd.Instance must be a valid absolute URL when AzureAd.Enabled is true.");
        }

        if (string.IsNullOrWhiteSpace(options.TenantId))
        {
            errors.Add("AzureAd.TenantId is required. Use 'common' / 'organizations' for multi-tenant or a tenant Guid for single-tenant.");
        }

        var multiTenant = string.Equals(options.TenantId, "common", StringComparison.OrdinalIgnoreCase)
            || string.Equals(options.TenantId, "organizations", StringComparison.OrdinalIgnoreCase);

        if (multiTenant && options.AllowedIssuers.Count == 0)
        {
            errors.Add(
                "AzureAd.AllowedIssuers must contain at least one issuer URL when TenantId is 'common' / 'organizations'. " +
                "Without it, tokens from any Microsoft tenant would be accepted.");
        }

        return errors.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(errors);
    }
}
