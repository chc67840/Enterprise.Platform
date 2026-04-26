using Enterprise.Platform.Api.Extensions;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Common.Models;
using Enterprise.Platform.Application.Features.Users.Commands;
using Enterprise.Platform.Application.Features.Users.Queries;
using Enterprise.Platform.Contracts.DTOs.App;
using Enterprise.Platform.Shared.Results;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace Enterprise.Platform.Api.Endpoints.v1.Users;

/// <summary>
/// Minimal-API endpoint group for the <c>User</c> aggregate. Mounted under
/// <c>/api/v1</c> via <see cref="RouteGroupExtensions.MapPlatformApiV1Group"/>
/// so every mutation inherits the platform's idempotency contract automatically.
/// </summary>
/// <remarks>
/// <para>
/// <b>Authorization model.</b> Mutations require an authenticated principal
/// (<c>RequireAuthorization()</c>). Fine-grained RBAC (e.g. only admins can
/// deactivate users) belongs in a future <c>permissionGuard</c>-style policy.
/// </para>
/// <para>
/// <b>Response shape.</b> Endpoints return native
/// <c>Microsoft.AspNetCore.Http.Results.*</c> types
/// (<see cref="Created"/> / <see cref="NoContent"/> / <see cref="Ok{T}"/> /
/// problem-details). FluentValidation runs through the MediatR pipeline; binding
/// errors flow through <c>GlobalExceptionMiddleware → BadHttpRequestException →
/// urn:ep:error:binding</c> per the P1-1 audit fix.
/// </para>
/// </remarks>
public static class UserEndpoints
{
    /// <summary>Maps every <c>/api/v1/users</c> endpoint.</summary>
    public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapPlatformApiV1Group()
            .MapGroup("/users")
            .RequireAuthorization()
            .WithTags("Users");

        group.MapGet("/{id:guid}", GetUserByIdAsync)
            .WithName("GetUserById")
            .WithSummary("Returns a single user by id.");

        group.MapGet("/", ListUsersAsync)
            .WithName("ListUsers")
            .WithSummary("Returns a paged list of users with optional search + active-only filter.");

        group.MapPost("/", CreateUserAsync)
            .WithName("CreateUser")
            .WithSummary("Registers a new platform user.");

        group.MapPut("/{id:guid}/name", RenameUserAsync)
            .WithName("RenameUser")
            .WithSummary("Replaces the user's first/last name.");

        group.MapPut("/{id:guid}/email", ChangeUserEmailAsync)
            .WithName("ChangeUserEmail")
            .WithSummary("Replaces the user's canonical email.");

        group.MapPost("/{id:guid}/activate", ActivateUserAsync)
            .WithName("ActivateUser")
            .WithSummary("Reactivates a deactivated user.");

        group.MapPost("/{id:guid}/deactivate", DeactivateUserAsync)
            .WithName("DeactivateUser")
            .WithSummary("Deactivates an active user (reversible).");

        return app;
    }

    // ── handlers ────────────────────────────────────────────────────────────

    private static async Task<Results<Ok<UserDto>, NotFound>> GetUserByIdAsync(
        [FromRoute] Guid id,
        IDispatcher dispatcher,
        CancellationToken cancellationToken)
    {
        var result = await dispatcher.QueryAsync(new GetUserByIdQuery(id), cancellationToken).ConfigureAwait(false);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : TypedResults.NotFound();
    }

    private static async Task<Ok<PagedResult<UserDto>>> ListUsersAsync(
        [AsParameters] ListUsersQuery query,
        IDispatcher dispatcher,
        CancellationToken cancellationToken)
    {
        var page = await dispatcher.QueryAsync(query, cancellationToken).ConfigureAwait(false);
        return TypedResults.Ok(page);
    }

    private static async Task<Results<Created<UserDto>, ProblemHttpResult>> CreateUserAsync(
        [FromBody] CreateUserCommand command,
        IDispatcher dispatcher,
        CancellationToken cancellationToken)
    {
        var result = await dispatcher.SendAsync(command, cancellationToken).ConfigureAwait(false);
        return result.IsSuccess
            ? TypedResults.Created($"/api/v1/users/{result.Value.Id}", result.Value)
            : TypedResults.Problem(detail: result.Error.Message, statusCode: StatusCodes.Status409Conflict, type: result.Error.Code);
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> RenameUserAsync(
        [FromRoute] Guid id,
        [FromBody] RenameUserBody body,
        IDispatcher dispatcher,
        CancellationToken cancellationToken)
    {
        var result = await dispatcher.SendAsync(new RenameUserCommand(id, body.FirstName, body.LastName), cancellationToken).ConfigureAwait(false);
        return result.IsSuccess
            ? TypedResults.NoContent()
            : TypedResults.Problem(detail: result.Error.Message, statusCode: ResolveStatus(result.Error), type: result.Error.Code);
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> ChangeUserEmailAsync(
        [FromRoute] Guid id,
        [FromBody] ChangeUserEmailBody body,
        IDispatcher dispatcher,
        CancellationToken cancellationToken)
    {
        var result = await dispatcher.SendAsync(new ChangeUserEmailCommand(id, body.Email), cancellationToken).ConfigureAwait(false);
        return result.IsSuccess
            ? TypedResults.NoContent()
            : TypedResults.Problem(detail: result.Error.Message, statusCode: ResolveStatus(result.Error), type: result.Error.Code);
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> ActivateUserAsync(
        [FromRoute] Guid id,
        IDispatcher dispatcher,
        CancellationToken cancellationToken)
    {
        var result = await dispatcher.SendAsync(new ActivateUserCommand(id), cancellationToken).ConfigureAwait(false);
        return result.IsSuccess
            ? TypedResults.NoContent()
            : TypedResults.Problem(detail: result.Error.Message, statusCode: ResolveStatus(result.Error), type: result.Error.Code);
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> DeactivateUserAsync(
        [FromRoute] Guid id,
        [FromBody] DeactivateUserBody body,
        IDispatcher dispatcher,
        CancellationToken cancellationToken)
    {
        var result = await dispatcher.SendAsync(new DeactivateUserCommand(id, body.Reason), cancellationToken).ConfigureAwait(false);
        return result.IsSuccess
            ? TypedResults.NoContent()
            : TypedResults.Problem(detail: result.Error.Message, statusCode: ResolveStatus(result.Error), type: result.Error.Code);
    }

    private static int ResolveStatus(Error error) => error.Code switch
    {
        ErrorCodes.NotFound => StatusCodes.Status404NotFound,
        ErrorCodes.Validation => StatusCodes.Status400BadRequest,
        ErrorCodes.Conflict => StatusCodes.Status409Conflict,
        ErrorCodes.Forbidden => StatusCodes.Status403Forbidden,
        ErrorCodes.Unauthorized => StatusCodes.Status401Unauthorized,
        _ => StatusCodes.Status500InternalServerError,
    };
}

/// <summary>Request body for <c>PUT /api/v1/users/{id}/name</c>.</summary>
public sealed record RenameUserBody(string FirstName, string LastName);

/// <summary>Request body for <c>PUT /api/v1/users/{id}/email</c>.</summary>
public sealed record ChangeUserEmailBody(string Email);

/// <summary>Request body for <c>POST /api/v1/users/{id}/deactivate</c>.</summary>
public sealed record DeactivateUserBody(string Reason);
