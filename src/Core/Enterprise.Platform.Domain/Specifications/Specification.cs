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
    public bool AsNoTracking { get; private set; }

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

    /// <summary>Enables <c>AsNoTracking</c> — defaults to off for safety on write paths.</summary>
    protected void UseNoTracking() => AsNoTracking = true;

    /// <summary>Enables <c>AsSplitQuery</c> for include-heavy specs.</summary>
    protected void UseSplitQuery() => AsSplitQuery = true;
}
