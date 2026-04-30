using System.Security.Claims;
using Enterprise.Platform.Application.Common.Authorization;
using Microsoft.AspNetCore.Authentication;
using EpClaimTypes = Enterprise.Platform.Shared.Constants.ClaimTypes;

namespace Enterprise.Platform.Api.Configuration;

/// <summary>
/// Phase-1 <see cref="IClaimsTransformation"/> — enriches every authenticated
/// principal with the canonical <c>ep:permission</c> claims drawn from
/// <see cref="Phase1Permissions"/>. Runs after JWT validation, before
/// authorization policies execute, so endpoints decorated with
/// <c>RequireAuthorization($"perm:{...}")</c> see the claims when their
/// <c>PermissionAuthorizationHandler</c> evaluates the principal.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why this is needed.</b> Entra-issued JWTs carry identity, roles, and
/// audience claims — but not the platform's fine-grained
/// <c>ep:permission</c> claims. Without this transformer the platform's
/// permission policies would always fail on Api-served endpoints (the
/// <c>/users</c> 403 was the symptom), even when the BFF cookie carried
/// the same claims (the cookie path is independent of the JWT path the
/// proxy forwards).
/// </para>
/// <para>
/// <b>Idempotency.</b> ASP.NET Core invokes <see cref="TransformAsync"/> on
/// every authenticated request. The implementation is a no-op when the
/// principal already carries every Phase-1 permission, so repeated calls
/// don't accumulate duplicate claims.
/// </para>
/// <para>
/// <b>Phase 2 migration.</b> Replace the static <see cref="Phase1Permissions.All"/>
/// read with a per-user lookup against the platform identity store
/// (<c>IPermissionsResolver</c> resolved via DI). The resolver takes the
/// principal (so it can extract the Entra <c>oid</c>) and returns the
/// user's actual permissions. Same transformer, different data source.
/// </para>
/// </remarks>
public sealed class Phase1ClaimsTransformer : IClaimsTransformation
{
    /// <inheritdoc />
    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        ArgumentNullException.ThrowIfNull(principal);

        // Anonymous principals (the framework wraps an empty identity even
        // when no scheme matched) — skip; only authenticated users get the
        // grant. Phase 2's SQL lookup will also need an authenticated user
        // to map to a row in the Users table.
        if (principal.Identity is not ClaimsIdentity identity || !identity.IsAuthenticated)
        {
            return Task.FromResult(principal);
        }

        // Build a snapshot of the existing permission claims so we can short-
        // circuit when the transformer has already run on this principal.
        var existing = identity.FindAll(EpClaimTypes.Permission)
            .Select(c => c.Value)
            .ToHashSet(StringComparer.Ordinal);

        foreach (var permission in Phase1Permissions.All)
        {
            if (existing.Add(permission))
            {
                identity.AddClaim(new Claim(EpClaimTypes.Permission, permission));
            }
        }

        return Task.FromResult(principal);
    }
}
