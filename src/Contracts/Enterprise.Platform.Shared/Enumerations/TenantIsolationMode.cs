namespace Enterprise.Platform.Shared.Enumerations;

/// <summary>
/// Multi-tenancy isolation strategies supported by the platform. Drives which
/// <c>TenantResolutionStrategy</c> the runtime selects and how EF Core query filters
/// are applied. Changing the mode is a deployment-time decision, not a per-request one.
/// </summary>
public enum TenantIsolationMode
{
    /// <summary>
    /// Single database, every tenant-aware table carries a <c>TenantId</c>. Cheapest to
    /// operate; highest risk of cross-tenant data leakage — requires the global query
    /// filter plus audit logging to be airtight.
    /// </summary>
    SharedDatabase = 0,

    /// <summary>
    /// Single database, one schema per tenant. Moderate isolation; migrations fan out per
    /// schema at deploy time.
    /// </summary>
    SchemaPerTenant = 1,

    /// <summary>
    /// One database per tenant. Strongest isolation and compliance story (HIPAA, PII
    /// residency); most expensive to operate. Requires the multi-DB factory to route by
    /// tenant id per request.
    /// </summary>
    DatabasePerTenant = 2,
}
