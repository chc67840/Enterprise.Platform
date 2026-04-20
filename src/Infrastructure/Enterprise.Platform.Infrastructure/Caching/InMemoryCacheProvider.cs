using Microsoft.Extensions.DependencyInjection;

namespace Enterprise.Platform.Infrastructure.Caching;

/// <summary>
/// Composition helper that wires a process-local <c>IDistributedCache</c>
/// (backed by <c>MemoryDistributedCache</c>). Good enough for dev and single-instance
/// deployments; never use in multi-node prod — cache entries won't be shared.
/// </summary>
public static class InMemoryCacheProvider
{
    /// <summary>Adds an in-memory distributed cache to <paramref name="services"/>.</summary>
    public static IServiceCollection AddInMemoryDistributedCache(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);
        services.AddDistributedMemoryCache();
        return services;
    }
}
