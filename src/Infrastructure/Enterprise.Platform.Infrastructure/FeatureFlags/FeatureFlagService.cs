using Enterprise.Platform.Infrastructure.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Infrastructure.FeatureFlags;

/// <summary>
/// Feature-flag evaluation contract. The Phase-7 stub reads values from
/// <c>FeatureFlags:{key}</c> in <see cref="IConfiguration"/> (returning <c>false</c>
/// when absent). A richer backend — Azure App Configuration with feature filters,
/// or LaunchDarkly — swaps in without changing callers.
/// </summary>
public interface IFeatureFlagService
{
    /// <summary>Returns <c>true</c> when <paramref name="flag"/> is enabled for the current context.</summary>
    Task<bool> IsEnabledAsync(string flag, CancellationToken cancellationToken = default);
}

/// <summary>
/// <b>Placeholder implementation.</b> Reads booleans from configuration; sufficient
/// for dev + conservative production rollouts but doesn't support targeting,
/// percentage rollout, or client identity.
/// </summary>
public sealed class ConfigurationFeatureFlagService(
    IConfiguration configuration,
    ILogger<ConfigurationFeatureFlagService> logger) : IFeatureFlagService
{
    private const string _sectionPrefix = "FeatureFlags:";

    private readonly IConfiguration _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
    private readonly ILogger<ConfigurationFeatureFlagService> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <inheritdoc />
    public Task<bool> IsEnabledAsync(string flag, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(flag);

        var raw = _configuration[$"{_sectionPrefix}{flag}"];
        var enabled = bool.TryParse(raw, out var parsed) && parsed;
        _logger.FeatureFlagEvaluated(flag, enabled);
        return Task.FromResult(enabled);
    }
}
