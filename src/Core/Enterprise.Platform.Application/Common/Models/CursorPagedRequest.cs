using Enterprise.Platform.Shared.Constants;

namespace Enterprise.Platform.Application.Common.Models;

/// <summary>
/// Cursor-based pagination parameters. The cursor is opaque to the caller — it's
/// produced by the previous page's response and round-tripped verbatim. Prefer this
/// over <see cref="PagedRequest"/> on large lists to keep page retrieval O(log n).
/// </summary>
public sealed class CursorPagedRequest
{
    private int _pageSize = AppConstants.Paging.DefaultPageSize;

    /// <summary>Opaque cursor from the previous page's response. <c>null</c> requests the first page.</summary>
    public string? Cursor { get; init; }

    /// <summary>Page size. Clamped to <c>[1, AppConstants.Paging.MaxPageSize]</c>.</summary>
    public int PageSize
    {
        get => _pageSize;
        init => _pageSize = Math.Clamp(value, 1, AppConstants.Paging.MaxPageSize);
    }

    /// <summary>Sort selectors. The cursor encodes the ordering so changing sort invalidates cursors.</summary>
    public IReadOnlyList<SortDescriptor> Sort { get; init; } = [];

    /// <summary>Filter selectors combined with AND semantics.</summary>
    public IReadOnlyList<FilterDescriptor> Filters { get; init; } = [];
}
