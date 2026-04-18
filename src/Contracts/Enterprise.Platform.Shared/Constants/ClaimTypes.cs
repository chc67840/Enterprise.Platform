namespace Enterprise.Platform.Shared.Constants;

/// <summary>
/// Custom JWT / <see cref="System.Security.Claims.ClaimsPrincipal"/> claim types issued
/// and consumed by Enterprise.Platform. Use these constants — never magic strings —
/// when reading or writing claims (enforced by CLAUDE.md §4, Claims-Based Authorization).
/// </summary>
public static class ClaimTypes
{
    /// <summary>Platform user id (GUID, string-serialized).</summary>
    public const string UserId = "ep:user_id";

    /// <summary>Tenant id the user is currently acting for.</summary>
    public const string TenantId = "ep:tenant_id";

    /// <summary>Fine-grained permission token (e.g. <c>users.read</c>, <c>audit.export</c>).</summary>
    public const string Permission = "ep:permission";

    /// <summary>Platform role name — used by <c>RbacPolicyProvider</c>.</summary>
    public const string Role = "ep:role";

    /// <summary>Session/token id — tied to refresh-token rotation and revocation.</summary>
    public const string SessionId = "ep:session_id";
}
