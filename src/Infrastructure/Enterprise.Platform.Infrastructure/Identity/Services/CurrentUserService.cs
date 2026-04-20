using System.Security.Claims;
using Enterprise.Platform.Domain.Interfaces;
using Microsoft.AspNetCore.Http;
using ClaimTypes = Enterprise.Platform.Shared.Constants.ClaimTypes;

namespace Enterprise.Platform.Infrastructure.Identity.Services;

/// <summary>
/// Claims-backed <see cref="ICurrentUserService"/>. Reads the authenticated principal
/// from <see cref="IHttpContextAccessor"/>; returns <c>null</c> / <c>false</c> for
/// anonymous or non-HTTP scopes (background jobs, tests) so consumers can branch
/// defensively.
/// </summary>
public sealed class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor
        ?? throw new ArgumentNullException(nameof(httpContextAccessor));

    /// <inheritdoc />
    public Guid? UserId
    {
        get
        {
            var raw = Principal?.FindFirst(ClaimTypes.UserId)?.Value;
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    /// <inheritdoc />
    public string? Email =>
        Principal?.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
        ?? Principal?.FindFirst("email")?.Value;

    /// <inheritdoc />
    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    /// <inheritdoc />
    public bool HasPermission(string permission)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(permission);
        return Principal?.Claims
            .Any(c => string.Equals(c.Type, ClaimTypes.Permission, StringComparison.Ordinal)
                      && string.Equals(c.Value, permission, StringComparison.Ordinal)) == true;
    }

    /// <inheritdoc />
    public bool IsInRole(string role)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(role);
        return Principal?.IsInRole(role) == true;
    }

    private ClaimsPrincipal? Principal => _httpContextAccessor.HttpContext?.User;
}
