namespace Enterprise.Platform.Application.Common.Models;

/// <summary>
/// Offset-pagination result. <see cref="TotalCount"/> is optional — expensive on
/// large datasets, so handlers may skip computing it and leave it <c>null</c>.
/// </summary>
/// <typeparam name="T">Row type.</typeparam>
public sealed class PagedResult<T>
{
    /// <summary>Rows for the requested page.</summary>
    public required IReadOnlyList<T> Items { get; init; }

    /// <summary>1-based page number this result represents.</summary>
    public required int PageNumber { get; init; }

    /// <summary>Page size honored by the handler (may be clamped).</summary>
    public required int PageSize { get; init; }

    /// <summary>Total matching rows. <c>null</c> when the handler declined to count.</summary>
    public long? TotalCount { get; init; }

    /// <summary>
    /// Convenience: derived total-page count. <c>null</c> when <see cref="TotalCount"/> is unknown.
    /// </summary>
    public int? TotalPages => TotalCount.HasValue && PageSize > 0
        ? (int)Math.Ceiling(TotalCount.Value / (double)PageSize)
        : null;
}
