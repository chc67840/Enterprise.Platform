namespace Enterprise.Platform.Infrastructure.FeatureFlags;

/// <summary>
/// Central registry of feature-flag keys. Handlers and middleware reference these
/// constants rather than raw strings so naming stays consistent and renames are
/// refactorable.
/// </summary>
public static class FeatureFlags
{
    /// <summary>Enables multi-tenancy isolation modes beyond <c>SharedDatabase</c>.</summary>
    public const string MultiTenantDatabaseIsolation = "ep.multitenant.db_isolation";

    /// <summary>Turns on the outbox-driven integration-event publisher.</summary>
    public const string OutboxPublishing = "ep.outbox.publishing";

    /// <summary>Exposes experimental endpoints guarded behind the <c>X-Preview-Features</c> header.</summary>
    public const string PreviewEndpoints = "ep.api.preview_endpoints";

    /// <summary>Uses AI summarisation in the admin console.</summary>
    public const string AiSummaries = "ep.admin.ai_summaries";
}
