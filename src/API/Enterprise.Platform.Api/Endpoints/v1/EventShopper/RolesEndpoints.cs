using Enterprise.Platform.Api.Filters;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Features.EventShopper.Roles.Commands;
using Enterprise.Platform.Application.Features.EventShopper.Roles.Queries;
using Microsoft.AspNetCore.Routing;

namespace Enterprise.Platform.Api.Endpoints.v1.EventShopper;

/// <summary>
/// EventShopper Roles endpoint surface — the canonical vertical slice for the
/// scaffolded aggregates. Reads dispatch <see cref="IQuery{TResult}"/>; writes
/// dispatch <see cref="ICommand{TResult}"/> through the Application pipeline
/// (logging → validation → tenant → audit → transaction → caching → idempotency).
/// Endpoints only translate HTTP shape ↔ command/query shape.
/// </summary>
public static class RolesEndpoints
{
    /// <summary>Wires the Roles routes into <paramref name="app"/> under <c>/api/v1/roles</c>.</summary>
    public static IEndpointRouteBuilder MapRolesEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/api/v1/roles")
            .WithTags("Roles")
            .RequireAuthorization();

        group.MapGet("/", async (
                string? nameContains,
                int pageNumber,
                int pageSize,
                IDispatcher dispatcher,
                CancellationToken ct) =>
            {
                var result = await dispatcher.QueryAsync(
                    new ListRolesQuery(
                        nameContains,
                        pageNumber <= 0 ? 1 : pageNumber,
                        pageSize <= 0 ? 25 : pageSize),
                    ct);
                return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
            })
            .WithName("Roles.List")
            .WithSummary("Lists Roles with name-substring filter + paging.");

        group.MapGet("/{id:int}", async (int id, IDispatcher dispatcher, CancellationToken ct) =>
            {
                var result = await dispatcher.QueryAsync(new GetRoleByIdQuery(id), ct);
                if (result.IsSuccess)
                {
                    return Results.Ok(result.Value);
                }

                return result.Error.Code == Shared.Results.ErrorCodes.NotFound
                    ? Results.NotFound(result.Error)
                    : Results.BadRequest(result.Error);
            })
            .WithName("Roles.GetById")
            .WithSummary("Fetches a Role by id.");

        group.MapPost("/", async (CreateRoleCommand command, IDispatcher dispatcher, CancellationToken ct) =>
            {
                var result = await dispatcher.SendAsync(command, ct);
                return result.IsSuccess
                    ? Results.Created($"/api/v1/roles/{result.Value}", new { id = result.Value })
                    : Results.Conflict(result.Error);
            })
            .AddEndpointFilter<ValidationEndpointFilter<CreateRoleCommand>>()
            .WithName("Roles.Create")
            .WithSummary("Creates a new Role.");

        group.MapPut("/{id:int}", async (int id, UpdateRoleCommand command, IDispatcher dispatcher, CancellationToken ct) =>
            {
                if (command.Id != id)
                {
                    return Results.BadRequest("Route id and body id must match.");
                }

                var result = await dispatcher.SendAsync(command, ct);
                return result.IsSuccess ? Results.NoContent() : Results.BadRequest(result.Error);
            })
            .AddEndpointFilter<ValidationEndpointFilter<UpdateRoleCommand>>()
            .WithName("Roles.Update")
            .WithSummary("Updates an existing Role.");

        group.MapDelete("/{id:int}", async (int id, byte[] rowVersion, IDispatcher dispatcher, CancellationToken ct) =>
            {
                var result = await dispatcher.SendAsync(new DeleteRoleCommand(id, rowVersion), ct);
                return result.IsSuccess ? Results.NoContent() : Results.BadRequest(result.Error);
            })
            .WithName("Roles.Delete")
            .WithSummary("Soft-deletes a Role.");

        return app;
    }
}
