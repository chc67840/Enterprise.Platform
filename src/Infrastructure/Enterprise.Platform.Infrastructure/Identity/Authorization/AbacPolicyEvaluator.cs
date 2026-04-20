namespace Enterprise.Platform.Infrastructure.Identity.Authorization;

/// <summary>
/// <b>Placeholder</b> for attribute-based access control (ABAC). Phase-7 ships only
/// the scaffold: when the platform needs policies that span principal attributes,
/// resource attributes, and environment (time-of-day, IP range, data-classification),
/// the evaluator body lands here.
/// </summary>
/// <remarks>
/// Expected shape:
/// <code>
/// public interface IAbacPolicyEvaluator
/// {
///     Task&lt;bool&gt; EvaluateAsync(ClaimsPrincipal principal, object resource, string action, AbacContext ctx);
/// }
/// </code>
/// Until the real implementation lands, endpoints should rely on RBAC permissions
/// via <see cref="RbacPolicyProvider"/> + <see cref="PermissionAuthorizationHandler"/>.
/// </remarks>
public static class AbacPolicyEvaluator
{
    // Intentionally empty — see the remarks block for the planned shape.
}
