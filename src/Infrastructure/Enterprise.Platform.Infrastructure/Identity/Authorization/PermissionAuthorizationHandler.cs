using Enterprise.Platform.Infrastructure.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;
using ClaimTypes = Enterprise.Platform.Shared.Constants.ClaimTypes;

namespace Enterprise.Platform.Infrastructure.Identity.Authorization;

/// <summary>
/// Evaluates a <see cref="PermissionRequirement"/> by inspecting the principal's
/// <c>ep:permission</c> claims. Succeeds when the requirement's permission is present;
/// otherwise logs the denial and leaves the context to fail.
/// </summary>
public sealed class PermissionAuthorizationHandler(ILogger<PermissionAuthorizationHandler> logger)
    : AuthorizationHandler<PermissionRequirement>
{
    private readonly ILogger<PermissionAuthorizationHandler> _logger = logger
        ?? throw new ArgumentNullException(nameof(logger));

    /// <inheritdoc />
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(requirement);

        var has = context.User.Claims
            .Any(c => string.Equals(c.Type, ClaimTypes.Permission, StringComparison.Ordinal)
                      && string.Equals(c.Value, requirement.Permission, StringComparison.Ordinal));

        if (has)
        {
            context.Succeed(requirement);
        }
        else
        {
            _logger.PermissionDenied(requirement.Permission);
        }

        return Task.CompletedTask;
    }
}
