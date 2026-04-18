using System.Linq.Expressions;
using System.Reflection;
using Enterprise.Platform.Application.Common.Models;
using Enterprise.Platform.Shared.Enumerations;

namespace Enterprise.Platform.Application.Common.Extensions;

/// <summary>
/// <see cref="IQueryable{T}"/> helpers for generic list endpoints — turn a
/// <see cref="PagedRequest"/> or a flat list of descriptors into a composed EF query.
/// Built on <c>Expression</c>s so everything translates to SQL.
/// </summary>
public static class QueryableExtensions
{
    private static readonly MethodInfo StringContains =
        typeof(string).GetMethod(nameof(string.Contains), [typeof(string)])!;

    /// <summary>Skips / takes per <paramref name="request"/>.</summary>
    public static IQueryable<T> ApplyPaging<T>(this IQueryable<T> source, PagedRequest request)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(request);

        return source.Skip(request.Skip).Take(request.PageSize);
    }

    /// <summary>Applies the supplied <see cref="SortDescriptor"/> list as OrderBy/ThenBy chains.</summary>
    public static IQueryable<T> ApplySorting<T>(
        this IQueryable<T> source,
        IEnumerable<SortDescriptor> sorts)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(sorts);

        IOrderedQueryable<T>? ordered = null;
        foreach (var sort in sorts)
        {
            var lambda = BuildPropertyAccessor<T>(sort.Field);
            if (ordered is null)
            {
                ordered = sort.Direction == SortDirection.Asc
                    ? source.OrderBy(lambda)
                    : source.OrderByDescending(lambda);
            }
            else
            {
                ordered = sort.Direction == SortDirection.Asc
                    ? ordered.ThenBy(lambda)
                    : ordered.ThenByDescending(lambda);
            }
        }

        return ordered ?? source;
    }

    /// <summary>
    /// Applies the supplied <see cref="FilterDescriptor"/> list with AND semantics.
    /// Supports the full operator set on <see cref="FilterOperator"/>; unknown operators
    /// raise <see cref="NotSupportedException"/>.
    /// </summary>
    public static IQueryable<T> ApplyFilters<T>(
        this IQueryable<T> source,
        IEnumerable<FilterDescriptor> filters)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(filters);

        foreach (var filter in filters)
        {
            var predicate = BuildPredicate<T>(filter);
            source = source.Where(predicate);
        }

        return source;
    }

    private static Expression<Func<T, object>> BuildPropertyAccessor<T>(string propertyPath)
    {
        var parameter = Expression.Parameter(typeof(T), "x");
        Expression body = parameter;
        foreach (var segment in propertyPath.Split('.'))
        {
            body = Expression.PropertyOrField(body, segment);
        }

        return Expression.Lambda<Func<T, object>>(Expression.Convert(body, typeof(object)), parameter);
    }

    private static Expression<Func<T, bool>> BuildPredicate<T>(FilterDescriptor filter)
    {
        var parameter = Expression.Parameter(typeof(T), "x");
        Expression member = parameter;
        foreach (var segment in filter.Field.Split('.'))
        {
            member = Expression.PropertyOrField(member, segment);
        }

        Expression body = filter.Operator switch
        {
            FilterOperator.Eq => Expression.Equal(member, ToConstant(filter.Value, member.Type)),
            FilterOperator.Neq => Expression.NotEqual(member, ToConstant(filter.Value, member.Type)),
            FilterOperator.Gt => Expression.GreaterThan(member, ToConstant(filter.Value, member.Type)),
            FilterOperator.Gte => Expression.GreaterThanOrEqual(member, ToConstant(filter.Value, member.Type)),
            FilterOperator.Lt => Expression.LessThan(member, ToConstant(filter.Value, member.Type)),
            FilterOperator.Lte => Expression.LessThanOrEqual(member, ToConstant(filter.Value, member.Type)),
            FilterOperator.Like => Expression.Call(member, StringContains, ToConstant(filter.Value, typeof(string))),
            FilterOperator.In => BuildContains(member, filter.Value),
            FilterOperator.Between => BuildBetween(member, filter.Value),
            _ => throw new NotSupportedException($"FilterOperator '{filter.Operator}' is not supported."),
        };

        return Expression.Lambda<Func<T, bool>>(body, parameter);
    }

    private static ConstantExpression ToConstant(object? value, Type targetType)
    {
        if (value is null)
        {
            return Expression.Constant(null, targetType);
        }

        // Handle Nullable<T> — unwrap to underlying type when converting.
        var underlying = Nullable.GetUnderlyingType(targetType) ?? targetType;
        var converted = Convert.ChangeType(value, underlying, System.Globalization.CultureInfo.InvariantCulture);
        return Expression.Constant(converted, targetType);
    }

    private static MethodCallExpression BuildContains(Expression member, object? value)
    {
        if (value is not System.Collections.IEnumerable enumerable)
        {
            throw new ArgumentException("Operator 'In' requires an enumerable value.", nameof(value));
        }

        var list = enumerable.Cast<object?>().ToArray();
        var arrayType = member.Type.MakeArrayType();
        var typedArray = Array.CreateInstance(member.Type, list.Length);
        for (var i = 0; i < list.Length; i++)
        {
            typedArray.SetValue(
                list[i] is null
                    ? null
                    : Convert.ChangeType(list[i], Nullable.GetUnderlyingType(member.Type) ?? member.Type, System.Globalization.CultureInfo.InvariantCulture),
                i);
        }

        var containsMethod = typeof(Enumerable)
            .GetMethods(BindingFlags.Public | BindingFlags.Static)
            .First(m => m.Name == nameof(Enumerable.Contains) && m.GetParameters().Length == 2)
            .MakeGenericMethod(member.Type);

        return Expression.Call(containsMethod, Expression.Constant(typedArray, arrayType), member);
    }

    private static BinaryExpression BuildBetween(Expression member, object? value)
    {
        if (value is not System.Collections.IList list || list.Count != 2)
        {
            throw new ArgumentException("Operator 'Between' requires a two-element array [lo, hi].", nameof(value));
        }

        var lo = ToConstant(list[0], member.Type);
        var hi = ToConstant(list[1], member.Type);
        return Expression.AndAlso(
            Expression.GreaterThanOrEqual(member, lo),
            Expression.LessThanOrEqual(member, hi));
    }
}
