using Microsoft.AspNetCore.Authorization;

namespace Enterprise.Platform.Infrastructure.Identity.Authorization;

/// <summary>
/// Authorization requirement: the principal must carry the named permission claim
/// (<c>ep:permission</c>). Composed into a policy on-demand by
/// <see cref="RbacPolicyProvider"/>.
/// </summary>
/// <param name="Permission">Fine-grained permission string (e.g. <c>"users.read"</c>).</param>
public sealed record PermissionRequirement(string Permission) : IAuthorizationRequirement;
