namespace Enterprise.Platform.Shared.Constants;

/// <summary>
/// Stable, canonical HTTP header names shared by the Api, BFF, and UI tiers. Using these
/// constants (rather than string literals) guarantees every layer reads and writes the
/// same header casing and spelling.
/// </summary>
public static class HttpHeaderNames
{
    /// <summary>End-to-end correlation id for tracing a single request across services.</summary>
    public const string CorrelationId = "X-Correlation-ID";

    /// <summary>Tenant id resolved by <c>TenantResolutionMiddleware</c> for multi-tenant routing.</summary>
    public const string TenantId = "X-Tenant-ID";

    /// <summary>Caller-supplied idempotency key for at-most-once command execution.</summary>
    public const string IdempotencyKey = "X-Idempotency-Key";

    /// <summary>Requested API version — consumed by <c>Asp.Versioning</c>.</summary>
    public const string ApiVersion = "X-API-Version";

    /// <summary>Client-specified request id (propagated in logs alongside <see cref="CorrelationId"/>).</summary>
    public const string RequestId = "X-Request-ID";
}
