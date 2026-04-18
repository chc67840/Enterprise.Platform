namespace Enterprise.Platform.Application.Common.Models;

/// <summary>
/// Cursor-pagination result. <see cref="NextCursor"/> is <c>null</c> when the last
/// page has been reached; <see cref="PreviousCursor"/> is <c>null</c> on the first
/// page. Cursors are opaque — never parse them client-side.
/// </summary>
/// <typeparam name="T">Row type.</typeparam>
public sealed class CursorPagedResult<T>
{
    /// <summary>Rows for the requested page.</summary>
    public required IReadOnlyList<T> Items { get; init; }

    /// <summary>Page size honored by the handler.</summary>
    public required int PageSize { get; init; }

    /// <summary>Cursor to fetch the next page, or <c>null</c> when this is the last page.</summary>
    public string? NextCursor { get; init; }

    /// <summary>Cursor to fetch the previous page, or <c>null</c> when this is the first page.</summary>
    public string? PreviousCursor { get; init; }
}
