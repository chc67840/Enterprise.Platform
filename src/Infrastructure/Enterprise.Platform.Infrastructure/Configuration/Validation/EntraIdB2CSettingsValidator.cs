using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Infrastructure.Configuration.Validation;

/// <summary>
/// Validates <see cref="EntraIdB2CSettings"/>. When Enabled is <c>true</c>,
/// ClientId / Instance / Domain / SignUpSignInPolicyId all become required.
/// </summary>
public sealed class EntraIdB2CSettingsValidator : IValidateOptions<EntraIdB2CSettings>
{
    /// <inheritdoc />
    public ValidateOptionsResult Validate(string? name, EntraIdB2CSettings options)
    {
        ArgumentNullException.ThrowIfNull(options);

        if (!options.Enabled)
        {
            return ValidateOptionsResult.Success;
        }

        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(options.ClientId))
        {
            errors.Add("AzureAdB2C.ClientId is required when Enabled is true.");
        }

        if (string.IsNullOrWhiteSpace(options.Instance))
        {
            errors.Add("AzureAdB2C.Instance is required (e.g. 'https://{tenant}.b2clogin.com/').");
        }

        if (string.IsNullOrWhiteSpace(options.Domain))
        {
            errors.Add("AzureAdB2C.Domain is required (e.g. '{tenant}.onmicrosoft.com').");
        }

        if (string.IsNullOrWhiteSpace(options.SignUpSignInPolicyId))
        {
            errors.Add("AzureAdB2C.SignUpSignInPolicyId is required.");
        }

        return errors.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(errors);
    }
}
