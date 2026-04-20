using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Shared.Enumerations;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using ClaimTypes = Enterprise.Platform.Shared.Constants.ClaimTypes;
using HttpHeaderNames = Enterprise.Platform.Shared.Constants.HttpHeaderNames;

namespace Enterprise.Platform.Infrastructure.Identity.Services;

/// <summary>
/// Resolves the current tenant per-request. Strategy is configured via
/// <see cref="MultiTenancySettings.ResolutionStrategy"/>; unresolved tenants fall back
/// to <see cref="MultiTenancySettings.DefaultTenantId"/> when
/// <see cref="MultiTenancySettings.RequireResolvedTenant"/> is <c>false</c>, otherwise
/// return <c>null</c> and let the pipeline's <c>TenantFilterBehavior</c> reject the
/// request.
/// </summary>
public sealed class CurrentTenantService(
    IHttpContextAccessor httpContextAccessor,
    IOptionsMonitor<MultiTenancySettings> settings) : ICurrentTenantService
{
    private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor
        ?? throw new ArgumentNullException(nameof(httpContextAccessor));

    private readonly IOptionsMonitor<MultiTenancySettings> _settings = settings
        ?? throw new ArgumentNullException(nameof(settings));

    /// <inheritdoc />
    public Guid? TenantId
    {
        get
        {
            var ctx = _httpContextAccessor.HttpContext;
            var current = _settings.CurrentValue;

            var raw = ctx is null
                ? null
                : current.ResolutionStrategy switch
                {
                    TenantResolutionStrategy.Claim => ctx.User?.FindFirst(ClaimTypes.TenantId)?.Value,
                    TenantResolutionStrategy.Header => ctx.Request.Headers.TryGetValue(HttpHeaderNames.TenantId, out var v)
                        ? v.ToString()
                        : null,
                    TenantResolutionStrategy.Subdomain => ExtractSubdomain(ctx),
                    TenantResolutionStrategy.RouteSegment => ExtractRouteTenant(ctx),
                    _ => null,
                };

            if (!string.IsNullOrWhiteSpace(raw) && Guid.TryParse(raw, out var id))
            {
                return id;
            }

            // Fallback — only honored when the settings say tenant resolution isn't strict.
            if (!current.RequireResolvedTenant
                && Guid.TryParse(current.DefaultTenantId, out var fallback))
            {
                return fallback;
            }

            return null;
        }
    }

    /// <inheritdoc />
    public TenantIsolationMode IsolationMode => _settings.CurrentValue.IsolationMode;

    private static string? ExtractSubdomain(HttpContext ctx)
    {
        var host = ctx.Request.Host.Host;
        var firstDot = host.IndexOf('.', StringComparison.Ordinal);
        return firstDot > 0 ? host[..firstDot] : null;
    }

    private static string? ExtractRouteTenant(HttpContext ctx)
    {
        // Convention: <origin>/tenants/{id}/... — inspects the second route segment.
        var path = ctx.Request.Path.Value;
        if (string.IsNullOrEmpty(path))
        {
            return null;
        }

        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return segments is ["tenants", var id, ..] ? id : null;
    }
}
