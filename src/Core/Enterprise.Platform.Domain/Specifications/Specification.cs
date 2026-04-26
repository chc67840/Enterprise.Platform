using System.Linq.Expressions;

namespace Enterprise.Platform.Domain.Specifications;

/// <summary>
/// Concrete specification base. Subclasses describe a query in the constructor via the
/// <c>Add*</c> / <c>Apply*</c> helpers; the infrastructure evaluator then translates
/// the description to EF Core.
/// </summary>
/// <typeparam name="T">Entity type.</typeparam>
public abstract class Specification<T> : ISpecification<T>
{
    private readonly List<Expression<Func<T, object>>> _includes = [];
    private readonly List<string> _includeStrings = [];

    /// <inheritdoc />
    public Expression<Func<T, bool>>? Criteria { get; private set; }

    /// <inheritdoc />
    public IReadOnlyList<Expression<Func<T, object>>> Includes => _includes.AsReadOnly();

    /// <inheritdoc />
    public IReadOnlyList<string> IncludeStrings => _includeStrings.AsReadOnly();

    /// <inheritdoc />
    public Expression<Func<T, object>>? OrderBy { get; private set; }

    /// <inheritdoc />
    public Expression<Func<T, object>>? OrderByDescending { get; private set; }

    /// <inheritdoc />
    public int Skip { get; private set; }

    /// <inheritdoc />
    public int Take { get; private set; }

    /// <inheritdoc />
    public bool IsPagingEnabled { get; private set; }

    /// <inheritdoc />
    /// <remarks>
    /// <b>P1-6 audit:</b> default flipped to <c>true</c> so READS are safe-by-default.
    /// Specifications used by write-side handlers (load aggregate → mutate → save)
    /// must opt INTO tracking via <see cref="UseTracking"/>. The earlier default
    /// (<c>false</c>) leaked tracked entities through every read path.
    /// </remarks>
    public bool AsNoTracking { get; private set; } = true;

    /// <inheritdoc />
    public bool AsSplitQuery { get; private set; }

    /// <summary>Sets or replaces the <c>WHERE</c> predicate.</summary>
    protected void SetCriteria(Expression<Func<T, bool>> criteria)
    {
        ArgumentNullException.ThrowIfNull(criteria);
        Criteria = criteria;
    }

    /// <summary>Adds a strongly-typed eager include.</summary>
    protected void AddInclude(Expression<Func<T, object>> includeExpression)
    {
        ArgumentNullException.ThrowIfNull(includeExpression);
        _includes.Add(includeExpression);
    }

    /// <summary>Adds a string-based include path (supports <c>.ThenInclude</c> chains).</summary>
    protected void AddInclude(string includeString)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(includeString);
        _includeStrings.Add(includeString);
    }

    /// <summary>Applies skip/take paging.</summary>
    protected void ApplyPaging(int skip, int take)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(skip);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(take);
        Skip = skip;
        Take = take;
        IsPagingEnabled = true;
    }

    /// <summary>Sets an ascending sort selector. Clears any previous sort.</summary>
    protected void ApplyOrderBy(Expression<Func<T, object>> orderBy)
    {
        ArgumentNullException.ThrowIfNull(orderBy);
        OrderBy = orderBy;
        OrderByDescending = null;
    }

    /// <summary>Sets a descending sort selector. Clears any previous sort.</summary>
    protected void ApplyOrderByDescending(Expression<Func<T, object>> orderByDescending)
    {
        ArgumentNullException.ThrowIfNull(orderByDescending);
        OrderByDescending = orderByDescending;
        OrderBy = null;
    }

    /// <summary>
    /// Enables <c>AsNoTracking</c>. <b>Now redundant</b> — <see cref="AsNoTracking"/>
    /// defaults to <c>true</c> (P1-6 audit). Kept for backward-compat / explicitness.
    /// </summary>
    protected void UseNoTracking() => AsNoTracking = true;

    /// <summary>
    /// Opts INTO change-tracking. Required for specifications consumed by write-side
    /// handlers that load → mutate → save the resulting entities. Without this
    /// (default after P1-6 audit), the spec returns untracked entities and any
    /// mutation is invisible to <c>SaveChangesAsync</c>.
    /// </summary>
    protected void UseTracking() => AsNoTracking = false;

    /// <summary>Enables <c>AsSplitQuery</c> for include-heavy specs.</summary>
    protected void UseSplitQuery() => AsSplitQuery = true;
}
