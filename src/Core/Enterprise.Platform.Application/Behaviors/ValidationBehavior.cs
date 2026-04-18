using Enterprise.Platform.Application.Abstractions.Behaviors;
using FluentValidation;

namespace Enterprise.Platform.Application.Behaviors;

/// <summary>
/// Pipeline order 2 — runs every registered <see cref="IValidator{T}"/> for the
/// request concurrently and aggregates failures. Throws <see cref="ValidationException"/>
/// (FluentValidation's) when any validator fails; the Api middleware translates that
/// to a 400 <c>ProblemDetailsExtended</c> with per-field errors.
/// </summary>
public sealed class ValidationBehavior<TRequest, TResponse>(
    IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    /// <inheritdoc />
    public async Task<TResponse> HandleAsync(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(next);

        var validatorList = validators.ToList();
        if (validatorList.Count == 0)
        {
            return await next().ConfigureAwait(false);
        }

        var context = new ValidationContext<TRequest>(request);
        var failures = new List<FluentValidation.Results.ValidationFailure>();

        foreach (var validator in validatorList)
        {
            var result = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
            if (!result.IsValid)
            {
                failures.AddRange(result.Errors);
            }
        }

        if (failures.Count > 0)
        {
            throw new ValidationException(failures);
        }

        return await next().ConfigureAwait(false);
    }
}
