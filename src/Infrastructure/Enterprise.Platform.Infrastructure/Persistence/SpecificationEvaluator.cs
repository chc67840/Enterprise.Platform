using Enterprise.Platform.Domain.Specifications;
using Microsoft.EntityFrameworkCore;

namespace Enterprise.Platform.Infrastructure.Persistence;

/// <summary>
/// Converts an <see cref="ISpecification{T}"/> into an <see cref="IQueryable{T}"/>.
/// Applied by <see cref="GenericRepository{T}"/> so handlers never touch EF directly —
/// they describe intent via specs, the evaluator translates.
/// </summary>
public static class SpecificationEvaluator
{
    /// <summary>
    /// Composes the spec against <paramref name="input"/> and returns the resulting
    /// queryable. Order: tracking mode → split-query → criteria → includes → order → paging.
    /// </summary>
    public static IQueryable<T> Apply<T>(IQueryable<T> input, ISpecification<T> specification)
        where T : class
    {
        ArgumentNullException.ThrowIfNull(input);
        ArgumentNullException.ThrowIfNull(specification);

        var query = input;

        if (specification.AsNoTracking)
        {
            query = query.AsNoTracking();
        }

        if (specification.AsSplitQuery)
        {
            query = query.AsSplitQuery();
        }

        if (specification.Criteria is not null)
        {
            query = query.Where(specification.Criteria);
        }

        query = specification.Includes.Aggregate(query, (current, include) => current.Include(include));
        query = specification.IncludeStrings.Aggregate(query, (current, include) => current.Include(include));

        if (specification.OrderBy is not null)
        {
            query = query.OrderBy(specification.OrderBy);
        }
        else if (specification.OrderByDescending is not null)
        {
            query = query.OrderByDescending(specification.OrderByDescending);
        }

        if (specification.IsPagingEnabled)
        {
            query = query.Skip(specification.Skip).Take(specification.Take);
        }

        return query;
    }
}
