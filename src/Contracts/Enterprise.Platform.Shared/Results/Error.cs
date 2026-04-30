namespace Enterprise.Platform.Shared.Results;

/// <summary>
/// Severity classification for an <see cref="Error"/>. Used by logging, alerting,
/// and response mapping to decide how loud the failure should be.
/// </summary>
/// <remarks>
/// NOT A UI VOCABULARY. Distinct from the SPA's DPH severity
/// (<c>'success' | 'warning' | 'danger' | 'info' | 'neutral'</c>) and the
/// chrome wire severity (<c>NavBadgeDto.Variant</c>). See
/// Docs/Architecture/MasterConfigModels.cs §F1 for the cross-tier mapping.
/// Values here are tuned for log/alert routing — adding a new value here is
/// a logging concern and does NOT require a UI vocabulary update.
/// </remarks>
public enum ErrorSeverity
{
    /// <summary>Informational — not a failure on its own; typically paired with warnings.</summary>
    Info = 0,

    /// <summary>Expected, recoverable failure — e.g. validation, not-found, conflict.</summary>
    Warning = 1,

    /// <summary>Unrecoverable or unexpected failure — surfaces as 5xx and alerts oncall.</summary>
    Critical = 2,
}

/// <summary>
/// Immutable, transport-agnostic error record returned inside a <see cref="Result"/> or
/// <see cref="Result{T}"/>. Exposes a machine-readable <see cref="Code"/> (see
/// <see cref="ErrorCodes"/>), a human-readable <see cref="Message"/>, and a
/// <see cref="Severity"/> hint.
/// </summary>
/// <param name="Code">Stable code from <see cref="ErrorCodes"/>. Never localize.</param>
/// <param name="Message">Human-readable description. Safe to localize.</param>
/// <param name="Severity">Severity classification. Defaults to <see cref="ErrorSeverity.Warning"/>.</param>
public sealed record Error(string Code, string Message, ErrorSeverity Severity = ErrorSeverity.Warning)
{
    /// <summary>Sentinel instance representing "no error" — paired with success results.</summary>
    public static readonly Error None = new(string.Empty, string.Empty, ErrorSeverity.Info);

    /// <summary>Builds a validation error (400-class; recoverable by the caller).</summary>
    public static Error Validation(string message) => new(ErrorCodes.Validation, message, ErrorSeverity.Warning);

    /// <summary>Builds a not-found error (404-class).</summary>
    public static Error NotFound(string message) => new(ErrorCodes.NotFound, message, ErrorSeverity.Warning);

    /// <summary>Builds a conflict error (409-class — concurrency, uniqueness, workflow state).</summary>
    public static Error Conflict(string message) => new(ErrorCodes.Conflict, message, ErrorSeverity.Warning);

    /// <summary>Builds an unauthorized error (401-class — missing/invalid credentials).</summary>
    public static Error Unauthorized(string message) => new(ErrorCodes.Unauthorized, message, ErrorSeverity.Warning);

    /// <summary>Builds a forbidden error (403-class — authenticated but not permitted).</summary>
    public static Error Forbidden(string message) => new(ErrorCodes.Forbidden, message, ErrorSeverity.Warning);

    /// <summary>Builds an internal error (500-class — unexpected, should alert oncall).</summary>
    public static Error Internal(string message) => new(ErrorCodes.Internal, message, ErrorSeverity.Critical);
}
