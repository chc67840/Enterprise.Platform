using Enterprise.Platform.Shared.Constants;

namespace Enterprise.Platform.Application.Common.Models;

/// <summary>
/// Offset-pagination parameters. Prefer <see cref="CursorPagedRequest"/> for
/// high-cardinality lists — offset gets expensive as the page number grows.
/// </summary>
public sealed class PagedRequest
{
    private int _pageNumber = AppConstants.Paging.DefaultPageNumber;
    private int _pageSize = AppConstants.Paging.DefaultPageSize;

    /// <summary>1-based page number. Clamped to >= 1.</summary>
    public int PageNumber
    {
        get => _pageNumber;
        set => _pageNumber = value < 1 ? 1 : value;
    }

    /// <summary>
    /// Page size. Clamped to <c>[1, AppConstants.Paging.MaxPageSize]</c>.
    /// </summary>
    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = Math.Clamp(value, 1, AppConstants.Paging.MaxPageSize);
    }

    /// <summary>Sort selectors. First entry is the primary sort; subsequent entries are tiebreakers.</summary>
    public IReadOnlyList<SortDescriptor> Sort { get; init; } = [];

    /// <summary>Filter selectors combined with AND semantics.</summary>
    public IReadOnlyList<FilterDescriptor> Filters { get; init; } = [];

    /// <summary>Computed skip value derived from <see cref="PageNumber"/> / <see cref="PageSize"/>.</summary>
    public int Skip => (PageNumber - 1) * PageSize;
}
