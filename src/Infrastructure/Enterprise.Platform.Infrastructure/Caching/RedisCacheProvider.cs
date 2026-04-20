using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.DependencyInjection;

namespace Enterprise.Platform.Infrastructure.Caching;

/// <summary>
/// Composition helper for Redis-backed distributed caching via
/// <c>Microsoft.Extensions.Caching.StackExchangeRedis</c>. Activates only when
/// <see cref="CacheSettings.Provider"/> is <see cref="CacheProvider.Redis"/> and a
/// connection string is populated; throws early otherwise so misconfiguration
/// surfaces at startup.
/// </summary>
public static class RedisCacheProvider
{
    /// <summary>
    /// Registers a StackExchange.Redis-backed <c>IDistributedCache</c>. Called from
    /// the Infrastructure DI root — no-op (returns services unchanged) when the
    /// provider is not Redis so InMemory wiring continues to apply.
    /// </summary>
    public static IServiceCollection AddRedisDistributedCache(
        this IServiceCollection services,
        CacheSettings settings)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(settings);

        if (settings.Provider != CacheProvider.Redis)
        {
            return services;
        }

        if (string.IsNullOrWhiteSpace(settings.RedisConnectionString))
        {
            throw new InvalidOperationException(
                "CacheSettings.Provider=Redis but CacheSettings.RedisConnectionString is not configured.");
        }

        services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = settings.RedisConnectionString;
            options.InstanceName = settings.KeyPrefix + ":";
        });

        return services;
    }
}
