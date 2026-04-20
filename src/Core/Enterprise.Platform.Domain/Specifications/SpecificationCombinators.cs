using System.Linq.Expressions;

namespace Enterprise.Platform.Domain.Specifications;

/// <summary>
/// Composition helpers for <see cref="ISpecification{T}"/>. Combine two specs via
/// <see cref="And"/> / <see cref="Or"/>, or negate with <see cref="Not"/>. The
/// combined spec preserves the criteria only — callers must re-apply includes,
/// paging, and sort on the composed spec if they want those to carry over.
/// </summary>
public static class SpecificationCombinators
{
    /// <summary>Returns a spec whose criteria is <c>left.Criteria AND right.Criteria</c>.</summary>
    public static ISpecification<T> And<T>(this ISpecification<T> left, ISpecification<T> right)
    {
        ArgumentNullException.ThrowIfNull(left);
        ArgumentNullException.ThrowIfNull(right);

        return new CombinedSpecification<T>(Combine(left.Criteria, right.Criteria, Expression.AndAlso));
    }

    /// <summary>Returns a spec whose criteria is <c>left.Criteria OR right.Criteria</c>.</summary>
    public static ISpecification<T> Or<T>(this ISpecification<T> left, ISpecification<T> right)
    {
        ArgumentNullException.ThrowIfNull(left);
        ArgumentNullException.ThrowIfNull(right);

        return new CombinedSpecification<T>(Combine(left.Criteria, right.Criteria, Expression.OrElse));
    }

    /// <summary>Returns a spec whose criteria is <c>NOT source.Criteria</c>.</summary>
    public static ISpecification<T> Not<T>(this ISpecification<T> source)
    {
        ArgumentNullException.ThrowIfNull(source);
        if (source.Criteria is null)
        {
            return new CombinedSpecification<T>(null);
        }

        var parameter = source.Criteria.Parameters[0];
        var negated = Expression.Lambda<Func<T, bool>>(Expression.Not(source.Criteria.Body), parameter);
        return new CombinedSpecification<T>(negated);
    }

    private static Expression<Func<T, bool>>? Combine<T>(
        Expression<Func<T, bool>>? left,
        Expression<Func<T, bool>>? right,
        Func<Expression, Expression, BinaryExpression> op)
    {
        if (left is null)
        {
            return right;
        }

        if (right is null)
        {
            return left;
        }

        var parameter = Expression.Parameter(typeof(T), "x");
        var leftBody = new ParameterReplacer(left.Parameters[0], parameter).Visit(left.Body);
        var rightBody = new ParameterReplacer(right.Parameters[0], parameter).Visit(right.Body);
        return Expression.Lambda<Func<T, bool>>(op(leftBody, rightBody), parameter);
    }

    private sealed class ParameterReplacer(ParameterExpression from, ParameterExpression to) : ExpressionVisitor
    {
        private readonly ParameterExpression _from = from;
        private readonly ParameterExpression _to = to;

        protected override Expression VisitParameter(ParameterExpression node)
            => node == _from ? _to : base.VisitParameter(node);
    }

    private sealed class CombinedSpecification<T>(Expression<Func<T, bool>>? criteria) : ISpecification<T>
    {
        public Expression<Func<T, bool>>? Criteria { get; } = criteria;
        public IReadOnlyList<Expression<Func<T, object>>> Includes { get; } = [];
        public IReadOnlyList<string> IncludeStrings { get; } = [];
        public Expression<Func<T, object>>? OrderBy => null;
        public Expression<Func<T, object>>? OrderByDescending => null;
        public int Skip => 0;
        public int Take => 0;
        public bool IsPagingEnabled => false;
        public bool AsNoTracking => true;
        public bool AsSplitQuery => false;
    }
}
