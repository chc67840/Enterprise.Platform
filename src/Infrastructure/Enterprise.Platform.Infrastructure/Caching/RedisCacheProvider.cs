using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.DependencyInjection;

namespace Enterprise.Platform.Infrastructure.Caching;

/// <summary>
/// <b>Placeholder.</b> Composition helper for Redis-backed distributed caching. The
/// canonical wiring is already committed to CPM (<c>Microsoft.Extensions.Caching.StackExchangeRedis</c>);
/// the lines are commented so a no-Redis dev box still bootstraps. Uncomment the
/// body + set <see cref="CacheSettings.RedisConnectionString"/> in configuration
/// when Redis goes live.
/// </summary>
public static class RedisCacheProvider
{
    /// <summary>
    /// Registers a <c>StackExchange.Redis</c>-backed <c>IDistributedCache</c>. Throws if
    /// <see cref="CacheSettings.RedisConnectionString"/> is not configured; opt in by
    /// calling this method from a host's composition root only when Redis is
    /// provisioned.
    /// </summary>
    public static IServiceCollection AddRedisDistributedCache(
        this IServiceCollection services,
        CacheSettings settings)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(settings);

        if (string.IsNullOrWhiteSpace(settings.RedisConnectionString))
        {
            throw new InvalidOperationException(
                "CacheSettings.RedisConnectionString is not configured — populate before wiring Redis.");
        }

        // Uncomment when the host is ready for Redis:
        // services.AddStackExchangeRedisCache(options =>
        // {
        //     options.Configuration = settings.RedisConnectionString;
        //     options.InstanceName = settings.KeyPrefix + ":";
        // });

        return services;
    }
}
