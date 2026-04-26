using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Contracts.Responses;

/// <summary>
/// Extended RFC 7807 <c>application/problem+json</c> payload. Adds platform-specific
/// diagnostic fields (correlation id, tenant id, per-field errors) on top of the
/// standard <c>type</c>/<c>title</c>/<c>status</c>/<c>detail</c>/<c>instance</c> shape.
/// <see cref="GlobalExceptionMiddleware"/> produces these for every failure path.
/// </summary>
public sealed class ProblemDetailsExtended
{
    /// <summary>
    /// Problem type URI (RFC 7807 §3.1). Should resolve to human-readable docs describing
    /// the error class; use a stable URN when no docs exist
    /// (e.g. <c>urn:ep:error:validation</c>).
    /// </summary>
    public string Type { get; init; } = "about:blank";

    /// <summary>Short, human-readable summary of the problem type. Not localized.</summary>
    public string Title { get; init; } = string.Empty;

    /// <summary>HTTP status code — mirrors the response status line.</summary>
    public int Status { get; init; }

    /// <summary>
    /// Human-readable explanation specific to this occurrence. Safe to localize — never
    /// include sensitive data (SQL fragments, stack traces, PII).
    /// </summary>
    public string? Detail { get; init; }

    /// <summary>URI reference identifying the specific occurrence of the problem.</summary>
    public string? Instance { get; init; }

    /// <summary>Correlation id for cross-service log tracing (<c>X-Correlation-ID</c>).</summary>
    public string? CorrelationId { get; init; }

    /// <summary>
    /// Structured error list — one entry per <see cref="Error"/> surfaced by the handler
    /// or validator. Clients render these inline on form fields when
    /// <see cref="FieldErrors"/> is populated instead.
    /// </summary>
    public IReadOnlyList<Error> Errors { get; init; } = [];

    /// <summary>
    /// Per-field validation errors, grouped by field name. Matches the FluentValidation
    /// shape so Angular / React forms can bind directly.
    /// Example: <c>{ "Email": ["must be a valid address"] }</c>.
    /// </summary>
    public IReadOnlyDictionary<string, IReadOnlyList<string>> FieldErrors { get; init; }
        = new Dictionary<string, IReadOnlyList<string>>();

    /// <summary>UTC timestamp the problem was produced — aids log correlation.</summary>
    public DateTimeOffset Timestamp { get; init; } = DateTimeOffset.UtcNow;
}
