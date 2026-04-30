namespace Enterprise.Platform.Application.Features.Users;

/// <summary>
/// Fine-grained permission tokens for the User feature. Endpoints decorate
/// themselves with <c>RequireAuthorization($"{PermissionPolicyPrefix}{...}")</c>;
/// the <c>RbacPolicyProvider</c> synthesises a <c>PermissionRequirement</c> on
/// demand and the <c>PermissionAuthorizationHandler</c> evaluates the
/// principal's <c>ep:permission</c> claims for an exact match.
/// </summary>
/// <remarks>
/// <para>
/// <b>Naming convention.</b> <c>&lt;aggregate&gt;.&lt;action&gt;</c>, lower-case, dot-
/// separated. Mirrors the platform convention documented on
/// <see cref="Shared.Constants.ClaimTypes.Permission"/>. The SPA's
/// <c>USER_PERMISSIONS</c> constants (in
/// <c>features/users/data/user.permissions.ts</c>) MUST match these
/// strings — both sides treat the wire format as a single source of truth.
/// </para>
/// <para>
/// <b>Action vocabulary.</b>
/// <list type="bullet">
///   <item><c>read</c> — list + detail view (GET endpoints).</item>
///   <item><c>create</c> — POST <c>/users</c> (provisioning a new account).</item>
///   <item><c>write</c> — rename, change email (mutate existing fields).</item>
///   <item><c>activate</c> — POST <c>/users/{id}/activate</c> (restores sign-in).</item>
///   <item><c>deactivate</c> — POST <c>/users/{id}/deactivate</c> (suspends sign-in).</item>
/// </list>
/// </para>
/// <para>
/// <b>Why activate / deactivate are split from write.</b> The audit and
/// compliance posture (HIPAA, SOX) treats activation-state changes as a
/// distinct privileged action — separate auth scope from "edit profile".
/// Suspending a user's access is a security-sensitive event in a way that
/// renaming them is not.
/// </para>
/// </remarks>
public static class UserPermissions
{
    /// <summary>List + detail read access. Required by all GET endpoints.</summary>
    public const string Read = "users.read";

    /// <summary>Provisioning a new user account.</summary>
    public const string Create = "users.create";

    /// <summary>Renaming, changing email — mutating existing profile fields.</summary>
    public const string Write = "users.write";

    /// <summary>Reactivating a previously deactivated user.</summary>
    public const string Activate = "users.activate";

    /// <summary>Deactivating an active user (revokes future sign-ins).</summary>
    public const string Deactivate = "users.deactivate";
}
