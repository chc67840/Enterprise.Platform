using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Contracts.Responses;

/// <summary>
/// Standard success envelope for REST endpoints. Wraps a typed payload with a
/// <see cref="ResponseMeta"/> block so the client can read correlation ids and
/// pagination consistently across every route. Failures use
/// <see cref="ProblemDetailsExtended"/> instead — never overload this envelope with
/// error fields.
/// </summary>
/// <typeparam name="T">Payload type.</typeparam>
public sealed class ApiResponse<T>
{
    /// <summary>Operation payload. <c>null</c> only for 204-style success-without-body responses.</summary>
    public T? Data { get; init; }

    /// <summary>Always <c>true</c> for this envelope. Failures use <see cref="ProblemDetailsExtended"/>.</summary>
    public bool Success { get; init; } = true;

    /// <summary>Supplementary metadata — correlation id, pagination, warnings.</summary>
    public ResponseMeta Meta { get; init; } = new();

    /// <summary>
    /// Non-fatal warnings emitted alongside a successful result (e.g. deprecation notices,
    /// partial-data warnings). Callers MAY ignore these; they never indicate failure.
    /// </summary>
    public IReadOnlyList<Error> Warnings { get; init; } = [];
}

/// <summary>
/// Factory helpers for <see cref="ApiResponse{T}"/>. Lives on the non-generic type so
/// callers write <c>ApiResponse.Ok(value)</c> with type inference rather than
/// <c>ApiResponse&lt;Foo&gt;.Ok(foo)</c>.
/// </summary>
public static class ApiResponse
{
    /// <summary>Builds a success envelope around <paramref name="data"/>.</summary>
    public static ApiResponse<T> Ok<T>(
        T data,
        ResponseMeta? meta = null,
        IReadOnlyList<Error>? warnings = null)
        => new()
        {
            Data = data,
            Success = true,
            Meta = meta ?? new ResponseMeta(),
            Warnings = warnings ?? [],
        };

    /// <summary>Builds a no-payload success envelope. Use for commands that return <c>Result</c>.</summary>
    public static ApiResponse<object?> Ok(ResponseMeta? meta = null)
        => Ok<object?>(null, meta);
}

/// <summary>
/// Envelope metadata. Every response carries one — the fields are optional but the
/// object itself is never null, which simplifies client deserialization.
/// </summary>
public sealed class ResponseMeta
{
    /// <summary>End-to-end correlation id (<c>X-Correlation-ID</c>). Echoed for diagnostics.</summary>
    public string? CorrelationId { get; init; }

    /// <summary>Tenant the response was computed for. Helps clients detect tenant drift.</summary>
    public string? TenantId { get; init; }

    /// <summary>UTC timestamp the response was produced. Useful for cache debugging.</summary>
    public DateTimeOffset ServerTime { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>API version that produced this response.</summary>
    public string? ApiVersion { get; init; }

    /// <summary>Pagination envelope — populated when the endpoint returns a page.</summary>
    public PaginationMeta? Pagination { get; init; }
}

/// <summary>
/// Pagination summary attached to list responses. Works for both offset and
/// cursor pagination — use the fields that apply.
/// </summary>
public sealed class PaginationMeta
{
    /// <summary>Total matching records. <c>null</c> when counting is too expensive / disabled.</summary>
    public long? TotalCount { get; init; }

    /// <summary>Page size actually returned.</summary>
    public int PageSize { get; init; }

    /// <summary>1-based page number — offset pagination only.</summary>
    public int? PageNumber { get; init; }

    /// <summary>Opaque cursor to the next page — cursor pagination only.</summary>
    public string? NextCursor { get; init; }

    /// <summary>Opaque cursor to the previous page — cursor pagination only.</summary>
    public string? PreviousCursor { get; init; }
}
