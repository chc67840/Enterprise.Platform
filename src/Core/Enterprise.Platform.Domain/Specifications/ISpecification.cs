using System.Linq.Expressions;

namespace Enterprise.Platform.Domain.Specifications;

/// <summary>
/// Filter / include / order / page description for a query. Passed to
/// <c>IGenericRepository&lt;T&gt;</c> so handlers stay expression-free and
/// infrastructure stays the sole place that translates specs to SQL.
/// </summary>
/// <typeparam name="T">Entity type the specification targets.</typeparam>
public interface ISpecification<T>
{
    /// <summary><c>WHERE</c> predicate. <c>null</c> means no filter.</summary>
    Expression<Func<T, bool>>? Criteria { get; }

    /// <summary>Eagerly-loaded navigations (strongly typed, <c>.Include(...)</c>).</summary>
    IReadOnlyList<Expression<Func<T, object>>> Includes { get; }

    /// <summary>String-based include paths — escape hatch for <c>ThenInclude</c> chains.</summary>
    IReadOnlyList<string> IncludeStrings { get; }

    /// <summary>Primary ascending order selector.</summary>
    Expression<Func<T, object>>? OrderBy { get; }

    /// <summary>Primary descending order selector.</summary>
    Expression<Func<T, object>>? OrderByDescending { get; }

    /// <summary>Number of rows to skip — <c>0</c> when paging is disabled.</summary>
    int Skip { get; }

    /// <summary>Maximum number of rows to return.</summary>
    int Take { get; }

    /// <summary><c>true</c> when <see cref="Skip"/>/<see cref="Take"/> should be applied.</summary>
    bool IsPagingEnabled { get; }

    /// <summary>
    /// When <c>true</c>, the resulting query is executed with
    /// <c>AsNoTracking</c>. Default for read-side queries; leave <c>false</c> for
    /// commands that mutate the result.
    /// </summary>
    bool AsNoTracking { get; }

    /// <summary>
    /// When <c>true</c>, the resulting query is executed with
    /// <c>AsSplitQuery</c> — recommended for specs that include multiple
    /// one-to-many collections.
    /// </summary>
    bool AsSplitQuery { get; }
}
