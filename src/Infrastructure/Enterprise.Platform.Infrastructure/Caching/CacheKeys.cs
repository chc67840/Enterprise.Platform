namespace Enterprise.Platform.Infrastructure.Caching;

/// <summary>
/// Centralised cache-key builders. Handlers should never hand-compose raw strings —
/// use the factories below so prefixes and delimiters stay consistent. The
/// <see cref="CacheSettings.KeyPrefix"/> value is applied at the cache layer, so
/// these methods return prefix-relative keys.
/// </summary>
/// <remarks>
/// Multi-tenant fanout helpers (<c>ForTenant</c>, <c>TenantPrefix</c>) were
/// removed 2026-04-25 with the single-tenant strip. If multi-tenancy is ever
/// reintroduced, restore them alongside the tenant-resolution middleware.
/// </remarks>
public static class CacheKeys
{
    /// <summary>Delimiter between key segments — URL-safe, never appears inside ids.</summary>
    public const char Delimiter = ':';

    /// <summary>Builds a platform-wide key: <c>platform:{region}:{id}</c>.</summary>
    public static string ForPlatform(string region, string id)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(region);
        ArgumentException.ThrowIfNullOrWhiteSpace(id);
        return $"platform{Delimiter}{region}{Delimiter}{id}";
    }

    /// <summary>Builds a user-scoped key: <c>user:{userId}:{region}:{id}</c>.</summary>
    public static string ForUser(Guid userId, string region, string id)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(region);
        ArgumentException.ThrowIfNullOrWhiteSpace(id);
        return $"user{Delimiter}{userId:N}{Delimiter}{region}{Delimiter}{id}";
    }
}
