using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Infrastructure.Identity.Authorization;

/// <summary>
/// Custom <see cref="IAuthorizationPolicyProvider"/> that materialises permission
/// policies on-demand. Endpoints decorate themselves with
/// <c>[Authorize(Policy = "perm:users.read")]</c> and this provider synthesises the
/// matching <see cref="PermissionRequirement"/> — no static registrations needed.
/// </summary>
public sealed class RbacPolicyProvider(IOptions<AuthorizationOptions> options) : IAuthorizationPolicyProvider
{
    /// <summary>Prefix the provider recognises on dynamic policy names.</summary>
    public const string PermissionPolicyPrefix = "perm:";

    private readonly DefaultAuthorizationPolicyProvider _fallback = new(options);

    /// <inheritdoc />
    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() => _fallback.GetDefaultPolicyAsync();

    /// <inheritdoc />
    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() => _fallback.GetFallbackPolicyAsync();

    /// <inheritdoc />
    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(policyName);

        if (policyName.StartsWith(PermissionPolicyPrefix, StringComparison.Ordinal))
        {
            var permission = policyName[PermissionPolicyPrefix.Length..];
            var policy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .AddRequirements(new PermissionRequirement(permission))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }

        return _fallback.GetPolicyAsync(policyName);
    }
}
