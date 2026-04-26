using System.Net;
using System.Net.Mime;
using System.Text.Json;
using Enterprise.Platform.Api.Common;
using Enterprise.Platform.Contracts.Responses;
using Enterprise.Platform.Domain.Exceptions;
using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Shared.Results;
using FluentValidation;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;

namespace Enterprise.Platform.Api.Middleware;

/// <summary>
/// Converts unhandled exceptions into RFC 7807 <see cref="ProblemDetailsExtended"/>
/// responses. Mapping: <see cref="DomainException"/> subclasses map to status codes
/// via their <c>ErrorCode</c>; FluentValidation <see cref="ValidationException"/> →
/// 400 with per-field errors; anything else → 500 with the message hidden outside
/// <c>Development</c>.
/// </summary>
public sealed class GlobalExceptionMiddleware(
    RequestDelegate next,
    IHostEnvironment environment,
    ILogger<GlobalExceptionMiddleware> logger)
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly RequestDelegate _next = next ?? throw new ArgumentNullException(nameof(next));
    private readonly IHostEnvironment _environment = environment ?? throw new ArgumentNullException(nameof(environment));
    private readonly ILogger<GlobalExceptionMiddleware> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <summary>Invokes the pipeline and converts thrown exceptions to problem responses.</summary>
    public async Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        try
        {
            await _next(context).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            await WriteProblemAsync(context, ex).ConfigureAwait(false);
        }
    }

    private async Task WriteProblemAsync(HttpContext context, Exception exception)
    {
        var (status, title, type) = ClassifyException(exception);
        var correlationId = context.Items[CorrelationIdMiddleware.ItemKey]?.ToString();

        var (errors, fieldErrors) = BuildErrors(exception);

        var problem = new ProblemDetailsExtended
        {
            Type = type,
            Title = title,
            Status = status,
            Detail = _environment.IsDevelopment() ? exception.Message : null,
            Instance = context.Request.Path,
            CorrelationId = correlationId,
            Errors = errors,
            FieldErrors = fieldErrors,
        };

        LogAtSeverity(exception, status, context.Request.Path);

        if (context.Response.HasStarted)
        {
            return;
        }

        context.Response.Clear();
        context.Response.StatusCode = status;
        context.Response.ContentType = $"{MediaTypeNames.Application.Json}; charset=utf-8";
        await JsonSerializer.SerializeAsync(context.Response.Body, problem, SerializerOptions).ConfigureAwait(false);
    }

    private static (int Status, string Title, string Type) ClassifyException(Exception exception) => exception switch
    {
        EntityNotFoundException => ((int)HttpStatusCode.NotFound, "Resource not found.", "urn:ep:error:not_found"),
        ValidationException => ((int)HttpStatusCode.BadRequest, "Validation failed.", "urn:ep:error:validation"),
        // P1-1 (audit) — body-binding failures (malformed JSON, type-coercion errors,
        // missing required fields) surface as `BadHttpRequestException` from
        // ASP.NET Core's model binder. Map them to the same RFC 7807 ProblemDetails
        // shape we use for semantic validation, so clients render binding errors
        // identically to FluentValidation errors instead of getting a raw 400.
        BadHttpRequestException => ((int)HttpStatusCode.BadRequest, "Request could not be bound.", "urn:ep:error:binding"),
        BusinessRuleViolationException => ((int)HttpStatusCode.Conflict, "Business rule violated.", "urn:ep:error:conflict"),
        ConcurrencyConflictException => ((int)HttpStatusCode.Conflict, "Concurrency conflict.", "urn:ep:error:conflict"),
        AccessDeniedException => ((int)HttpStatusCode.Forbidden, "Access denied.", "urn:ep:error:forbidden"),
        DomainException => ((int)HttpStatusCode.BadRequest, "Domain rule failure.", "urn:ep:error:domain"),
        _ => ((int)HttpStatusCode.InternalServerError, "Unexpected server error.", "urn:ep:error:internal"),
    };

    private static (IReadOnlyList<Error> Errors, IReadOnlyDictionary<string, IReadOnlyList<string>> FieldErrors) BuildErrors(Exception exception)
    {
        if (exception is ValidationException vex)
        {
            var grouped = vex.Errors
                .GroupBy(e => e.PropertyName, StringComparer.Ordinal)
                .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(e => e.ErrorMessage).ToArray(), StringComparer.Ordinal);
            return (Array.Empty<Error>(), grouped);
        }

        if (exception is DomainException dex)
        {
            return (new[] { new Error(dex.ErrorCode, dex.Message, ErrorSeverity.Warning) }, new Dictionary<string, IReadOnlyList<string>>());
        }

        return (new[] { Error.Internal("Unexpected server error.") }, new Dictionary<string, IReadOnlyList<string>>());
    }

    private void LogAtSeverity(Exception exception, int status, PathString path)
    {
        var pathString = path.Value ?? string.Empty;
        if (status >= 500)
        {
            _logger.UnhandledException(exception, pathString, status);
        }
        else
        {
            _logger.HandledException(exception, pathString, status);
        }
    }
}
