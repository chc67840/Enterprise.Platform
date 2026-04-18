namespace Enterprise.Platform.Contracts.Settings;

/// <summary>
/// Caching provider + per-region TTLs. Bound from the <c>Cache</c> section.
/// Handlers read <see cref="Regions"/> by name so TTLs stay out of code and can be
/// tuned per environment.
/// </summary>
public sealed class CacheSettings
{
    /// <summary>Configuration section name — <c>Cache</c>.</summary>
    public const string SectionName = "Cache";

    /// <summary>Which provider the runtime composes. See <see cref="CacheProvider"/>.</summary>
    public CacheProvider Provider { get; set; } = CacheProvider.InMemory;

    /// <summary>
    /// Redis connection string — bound only when <see cref="Provider"/> is
    /// <see cref="CacheProvider.Redis"/>. Resolved from Key Vault / user-secrets in
    /// non-dev environments.
    /// </summary>
    public string? RedisConnectionString { get; set; }

    /// <summary>
    /// Prefix prepended to every cache key. Prevents collisions when multiple services
    /// share a Redis instance. Default <c>"ep"</c>.
    /// </summary>
    public string KeyPrefix { get; set; } = "ep";

    /// <summary>
    /// Default TTL used when a caller does not specify one and the key's region
    /// is not in <see cref="Regions"/>.
    /// </summary>
    public TimeSpan DefaultTtl { get; set; } = TimeSpan.FromMinutes(5);

    /// <summary>
    /// Named TTL regions. Keys are region names (<c>"users"</c>, <c>"tenants"</c>,
    /// <c>"lookups"</c>, ...); values are the TTL for all keys within that region.
    /// </summary>
    public Dictionary<string, TimeSpan> Regions { get; set; } = new();
}

/// <summary>Caching backends supported by <see cref="CacheSettings"/>.</summary>
public enum CacheProvider
{
    /// <summary>Process-local <c>IMemoryCache</c> — fine for single-instance dev, never share state.</summary>
    InMemory = 0,

    /// <summary>Redis via <c>StackExchange.Redis</c> — the production default.</summary>
    Redis = 1,
}
