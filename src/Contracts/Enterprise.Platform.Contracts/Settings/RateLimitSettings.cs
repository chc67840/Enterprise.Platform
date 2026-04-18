namespace Enterprise.Platform.Contracts.Settings;

/// <summary>
/// Rate-limit thresholds bound from the <c>RateLimit</c> configuration section.
/// The Api wires these into <c>System.Threading.RateLimiting</c> fixed-window limiters —
/// one global partition and one per-tenant partition. Values of <c>0</c> disable that
/// limiter.
/// </summary>
public sealed class RateLimitSettings
{
    /// <summary>Configuration section name — <c>RateLimit</c>.</summary>
    public const string SectionName = "RateLimit";

    /// <summary>
    /// Global (all traffic) permits per <see cref="Window"/>. A first line of defence
    /// against volumetric abuse; per-tenant limits kick in after the global check passes.
    /// </summary>
    public int GlobalPermitsPerWindow { get; set; } = 1000;

    /// <summary>Per-tenant permits per <see cref="Window"/>.</summary>
    public int PerTenantPermitsPerWindow { get; set; } = 300;

    /// <summary>Per-user permits per <see cref="Window"/>. Zero disables.</summary>
    public int PerUserPermitsPerWindow { get; set; } = 120;

    /// <summary>
    /// Rolling / fixed window for all three limits. Default 1 minute; the Api rejects
    /// requests that exceed the configured count inside the window.
    /// </summary>
    public TimeSpan Window { get; set; } = TimeSpan.FromMinutes(1);

    /// <summary>
    /// Queue depth per partition — requests accepted but held waiting for a permit.
    /// <c>0</c> = reject immediately when the window is exhausted.
    /// </summary>
    public int QueueLimit { get; set; }

    /// <summary>
    /// When <c>true</c>, the Api returns a <c>Retry-After</c> header derived from the
    /// current window. Recommended — gives well-behaved clients a path to back off.
    /// </summary>
    public bool EmitRetryAfterHeader { get; set; } = true;
}
