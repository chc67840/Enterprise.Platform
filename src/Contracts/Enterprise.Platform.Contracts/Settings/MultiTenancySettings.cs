using Enterprise.Platform.Shared.Enumerations;

namespace Enterprise.Platform.Contracts.Settings;

/// <summary>
/// Multi-tenant runtime configuration. <see cref="IsolationMode"/> drives how EF Core
/// filters rows and which <c>DbContext</c> the factory resolves;
/// <see cref="ResolutionStrategy"/> drives how the request pipeline identifies the
/// tenant from the incoming HTTP call.
/// </summary>
public sealed class MultiTenancySettings
{
    /// <summary>Configuration section name — <c>MultiTenancy</c>.</summary>
    public const string SectionName = "MultiTenancy";

    /// <summary>
    /// Physical isolation strategy. See <see cref="TenantIsolationMode"/> for trade-offs.
    /// Defaults to <see cref="TenantIsolationMode.SharedDatabase"/> — the cheapest but
    /// most discipline-dependent mode.
    /// </summary>
    public TenantIsolationMode IsolationMode { get; set; } = TenantIsolationMode.SharedDatabase;

    /// <summary>
    /// How <c>TenantResolutionMiddleware</c> determines the current tenant per request.
    /// </summary>
    public TenantResolutionStrategy ResolutionStrategy { get; set; } = TenantResolutionStrategy.Claim;

    /// <summary>
    /// Tenant id returned to callers that do not identify a tenant. Use only for public,
    /// anonymous endpoints (landing pages, health); leave empty to force every request
    /// through tenant resolution.
    /// </summary>
    public string? DefaultTenantId { get; set; }

    /// <summary>
    /// When <c>true</c>, requests that fail tenant resolution are rejected with 400.
    /// When <c>false</c>, they fall through to the default tenant (above). Default
    /// <c>true</c> — tenant ambiguity is a security bug.
    /// </summary>
    public bool RequireResolvedTenant { get; set; } = true;
}

/// <summary>
/// Where <c>TenantResolutionMiddleware</c> looks to identify the current tenant.
/// Exactly one strategy is active per environment.
/// </summary>
public enum TenantResolutionStrategy
{
    /// <summary>Read <c>ep:tenant_id</c> claim from the authenticated principal.</summary>
    Claim = 0,

    /// <summary>Read the <c>X-Tenant-ID</c> header. Typical for first-party BFFs.</summary>
    Header = 1,

    /// <summary>Parse the tenant id from the host (e.g. <c>tenant-a.platform.local</c>).</summary>
    Subdomain = 2,

    /// <summary>Parse the tenant id from a route segment (e.g. <c>/tenants/{id}/...</c>).</summary>
    RouteSegment = 3,
}
