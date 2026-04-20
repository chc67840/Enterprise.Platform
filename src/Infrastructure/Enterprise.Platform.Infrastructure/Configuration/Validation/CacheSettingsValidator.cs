using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Infrastructure.Configuration.Validation;

/// <summary>
/// Validates <see cref="CacheSettings"/>. Redis provider requires a connection
/// string; TTLs must be positive; key prefix must be non-empty.
/// </summary>
public sealed class CacheSettingsValidator : IValidateOptions<CacheSettings>
{
    /// <inheritdoc />
    public ValidateOptionsResult Validate(string? name, CacheSettings options)
    {
        ArgumentNullException.ThrowIfNull(options);

        var errors = new List<string>();

        if (options.Provider == CacheProvider.Redis && string.IsNullOrWhiteSpace(options.RedisConnectionString))
        {
            errors.Add("Cache.Provider is Redis but Cache.RedisConnectionString is empty.");
        }

        if (options.DefaultTtl <= TimeSpan.Zero)
        {
            errors.Add($"Cache.DefaultTtl must be > 0; got {options.DefaultTtl}.");
        }

        foreach (var (region, ttl) in options.Regions)
        {
            if (ttl <= TimeSpan.Zero)
            {
                errors.Add($"Cache.Regions['{region}'] must be > 0; got {ttl}.");
            }
        }

        if (string.IsNullOrWhiteSpace(options.KeyPrefix))
        {
            errors.Add("Cache.KeyPrefix is required.");
        }

        return errors.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(errors);
    }
}
