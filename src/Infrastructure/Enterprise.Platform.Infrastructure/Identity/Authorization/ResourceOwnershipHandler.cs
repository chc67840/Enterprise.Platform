using Enterprise.Platform.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;

namespace Enterprise.Platform.Infrastructure.Identity.Authorization;

/// <summary>
/// Requirement: the resource being acted on must belong to the current principal.
/// Endpoints supply the resource via <c>AuthorizationHandlerContext.Resource</c> and
/// the handler's strategy decides whether ownership holds.
/// </summary>
public sealed record ResourceOwnershipRequirement : IAuthorizationRequirement;

/// <summary>
/// Default <see cref="ResourceOwnershipRequirement"/> evaluator — checks whether the
/// resource has an <c>OwnerId</c> / <c>UserId</c> / <c>CreatedBy</c> property that
/// matches <see cref="ICurrentUserService.UserId"/>. Extend or replace with a
/// domain-specific handler when a richer ownership model is needed.
/// </summary>
public sealed class ResourceOwnershipHandler(ICurrentUserService currentUser)
    : AuthorizationHandler<ResourceOwnershipRequirement>
{
    private static readonly string[] OwnershipPropertyNames = ["OwnerId", "UserId", "CreatedBy"];

    private readonly ICurrentUserService _currentUser = currentUser
        ?? throw new ArgumentNullException(nameof(currentUser));

    /// <inheritdoc />
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ResourceOwnershipRequirement requirement)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.Resource is null || _currentUser.UserId is not { } userId)
        {
            return Task.CompletedTask;
        }

        var type = context.Resource.GetType();
        foreach (var candidate in OwnershipPropertyNames)
        {
            var property = type.GetProperty(candidate);
            if (property is null)
            {
                continue;
            }

            var value = property.GetValue(context.Resource);
            if (value is Guid owner && owner == userId)
            {
                context.Succeed(requirement);
                return Task.CompletedTask;
            }

            if (value is string raw && Guid.TryParse(raw, out var parsed) && parsed == userId)
            {
                context.Succeed(requirement);
                return Task.CompletedTask;
            }
        }

        return Task.CompletedTask;
    }
}
