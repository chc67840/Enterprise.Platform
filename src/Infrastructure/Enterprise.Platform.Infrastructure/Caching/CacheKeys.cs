namespace Enterprise.Platform.Infrastructure.Caching;

/// <summary>
/// Centralised cache-key builders. Handlers should never hand-compose raw strings —
/// use the factories below so prefixes, delimiters, and tenant fanout stay consistent.
/// The <see cref="CacheSettings.KeyPrefix"/> value is applied at the cache layer, so
/// these methods return prefix-relative keys.
/// </summary>
public static class CacheKeys
{
    /// <summary>Delimiter between key segments — URL-safe, never appears inside ids.</summary>
    public const char Delimiter = ':';

    /// <summary>Builds a tenant-scoped key: <c>tenant:{tenantId}:{region}:{id}</c>.</summary>
    public static string ForTenant(Guid tenantId, string region, string id)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(region);
        ArgumentException.ThrowIfNullOrWhiteSpace(id);
        return $"tenant{Delimiter}{tenantId:N}{Delimiter}{region}{Delimiter}{id}";
    }

    /// <summary>Builds a platform-wide (tenant-agnostic) key: <c>platform:{region}:{id}</c>.</summary>
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

    /// <summary>Prefix matching helper — derive a sub-space prefix for bulk invalidation.</summary>
    public static string TenantPrefix(Guid tenantId, string? region = null)
    {
        var suffix = string.IsNullOrWhiteSpace(region) ? string.Empty : $"{Delimiter}{region}";
        return $"tenant{Delimiter}{tenantId:N}{suffix}";
    }
}
