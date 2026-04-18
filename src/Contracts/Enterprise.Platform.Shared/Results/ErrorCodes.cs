namespace Enterprise.Platform.Shared.Results;

/// <summary>
/// Stable, machine-readable error code constants. Used inside <see cref="Error"/> so that
/// API consumers and observability pipelines can branch on code without parsing messages.
/// Codes are namespaced with a two-letter prefix (<c>EP</c> = Enterprise.Platform) so that
/// emitted codes do not collide with third-party error vocabularies.
/// </summary>
public static class ErrorCodes
{
    /// <summary>Input failed validation (FluentValidation, Guard, or handler-level check).</summary>
    public const string Validation = "EP.Validation";

    /// <summary>Requested resource does not exist (or caller cannot see that it exists).</summary>
    public const string NotFound = "EP.NotFound";

    /// <summary>Operation conflicts with current state (optimistic-concurrency, uniqueness, workflow).</summary>
    public const string Conflict = "EP.Conflict";

    /// <summary>Caller is authenticated but not permitted to perform the operation.</summary>
    public const string Forbidden = "EP.Forbidden";

    /// <summary>Caller is not authenticated (missing, invalid, or expired credentials).</summary>
    public const string Unauthorized = "EP.Unauthorized";

    /// <summary>Unexpected server-side failure — should trigger alerts, not user guidance.</summary>
    public const string Internal = "EP.Internal";
}
