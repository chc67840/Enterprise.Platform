using Enterprise.Platform.Api.Extensions;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Common.Models;
using Enterprise.Platform.Application.Features.Users;
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
/// <b>Authorization model.</b> Each endpoint is gated by a fine-grained
/// permission policy synthesised by <c>RbacPolicyProvider</c> from a
/// <c>perm:&lt;permission&gt;</c> string, e.g. <c>perm:users.read</c>. The
/// permission tokens themselves come from <see cref="UserPermissions"/> so the
/// SPA's <c>USER_PERMISSIONS</c> constants and the API stay in lock-step. Read
/// endpoints require <see cref="UserPermissions.Read"/>; activation-state
/// transitions require their own dedicated permissions
/// (<see cref="UserPermissions.Activate"/> / <see cref="UserPermissions.Deactivate"/>)
/// — these are intentionally split from <see cref="UserPermissions.Write"/> so
/// HIPAA/SOX auditors can grant "edit profile" without granting "suspend access".
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
            .RequireAuthorization(PermissionPolicy(UserPermissions.Read))
            .WithName("GetUserById")
            .WithSummary("Returns a single user by id.")
            .Produces<UserDto>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/", ListUsersAsync)
            .RequireAuthorization(PermissionPolicy(UserPermissions.Read))
            .WithName("ListUsers")
            .WithSummary("Returns a paged list of users with optional search + active-only filter.")
            .Produces<PagedResult<UserDto>>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status403Forbidden);

        group.MapPost("/", CreateUserAsync)
            .RequireAuthorization(PermissionPolicy(UserPermissions.Create))
            .RequireIdempotencyKey()
            .WithName("CreateUser")
            .WithSummary("Registers a new platform user.")
            .Produces<UserDto>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPut("/{id:guid}/name", RenameUserAsync)
            .RequireAuthorization(PermissionPolicy(UserPermissions.Write))
            .RequireIdempotencyKey()
            .WithName("RenameUser")
            .WithSummary("Replaces the user's first/last name.")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPut("/{id:guid}/email", ChangeUserEmailAsync)
            .RequireAuthorization(PermissionPolicy(UserPermissions.Write))
            .RequireIdempotencyKey()
            .WithName("ChangeUserEmail")
            .WithSummary("Replaces the user's canonical email.")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/{id:guid}/activate", ActivateUserAsync)
            .RequireAuthorization(PermissionPolicy(UserPermissions.Activate))
            .RequireIdempotencyKey()
            .WithName("ActivateUser")
            .WithSummary("Reactivates a deactivated user.")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/{id:guid}/deactivate", DeactivateUserAsync)
            .RequireAuthorization(PermissionPolicy(UserPermissions.Deactivate))
            .RequireIdempotencyKey()
            .WithName("DeactivateUser")
            .WithSummary("Deactivates an active user (reversible).")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return app;
    }

    /// <summary>
    /// Builds the dynamic policy name consumed by <c>RbacPolicyProvider</c>
    /// (e.g. <c>users.read</c> → <c>perm:users.read</c>). Centralised so the
    /// <c>perm:</c> prefix lives in exactly one place per endpoint group.
    /// </summary>
    private static string PermissionPolicy(string permission) => $"perm:{permission}";

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
