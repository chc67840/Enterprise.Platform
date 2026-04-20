using Enterprise.Platform.Contracts.Responses;
using Enterprise.Platform.Shared.Results;
using FluentValidation;

namespace Enterprise.Platform.Api.Filters;

/// <summary>
/// Minimal-API endpoint filter that validates the <typeparamref name="TRequest"/>
/// payload via any registered <see cref="IValidator{TRequest}"/>s before the handler
/// runs. Returns a 400 <see cref="ProblemDetailsExtended"/> on failure so handlers
/// never see invalid input. Complements the Application-tier
/// <c>ValidationBehavior</c>: this filter catches HTTP-boundary inputs even when a
/// command wraps them later.
/// </summary>
/// <typeparam name="TRequest">Request DTO type.</typeparam>
public sealed class ValidationEndpointFilter<TRequest> : IEndpointFilter
    where TRequest : notnull
{
    /// <inheritdoc />
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(next);

        var request = context.Arguments.OfType<TRequest>().FirstOrDefault();
        if (request is null)
        {
            return await next(context).ConfigureAwait(false);
        }

        var validators = context.HttpContext.RequestServices.GetServices<IValidator<TRequest>>().ToList();
        if (validators.Count == 0)
        {
            return await next(context).ConfigureAwait(false);
        }

        var validationContext = new ValidationContext<TRequest>(request);
        var failures = new List<FluentValidation.Results.ValidationFailure>();
        foreach (var validator in validators)
        {
            var result = await validator.ValidateAsync(validationContext, context.HttpContext.RequestAborted).ConfigureAwait(false);
            if (!result.IsValid)
            {
                failures.AddRange(result.Errors);
            }
        }

        if (failures.Count == 0)
        {
            return await next(context).ConfigureAwait(false);
        }

        var fieldErrors = failures
            .GroupBy(f => f.PropertyName, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(f => f.ErrorMessage).ToArray(), StringComparer.Ordinal);

        var problem = new ProblemDetailsExtended
        {
            Type = "urn:ep:error:validation",
            Title = "Validation failed.",
            Status = StatusCodes.Status400BadRequest,
            Instance = context.HttpContext.Request.Path,
            Errors = [Error.Validation("One or more fields failed validation.")],
            FieldErrors = fieldErrors,
        };

        return Results.Json(problem, statusCode: StatusCodes.Status400BadRequest);
    }
}
