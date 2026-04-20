using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Infrastructure.MultiTenancy;
using Microsoft.Extensions.Options;
using Serilog.Context;

namespace Enterprise.Platform.Api.Middleware;

/// <summary>
/// Ensures the current request has a resolved tenant (when configuration demands
/// it) and applies the active <see cref="ITenantIsolationStrategy"/>. Reads the
/// tenant via <see cref="ICurrentTenantService"/> — the actual extraction
/// (claim / header / subdomain / route segment) is delegated to the service so this
/// middleware stays strategy-agnostic.
/// </summary>
public sealed class TenantResolutionMiddleware(RequestDelegate next)
{
    private readonly RequestDelegate _next = next ?? throw new ArgumentNullException(nameof(next));

    /// <summary>Invokes the middleware.</summary>
    public async Task InvokeAsync(
        HttpContext context,
        ICurrentTenantService currentTenant,
        IEnumerable<ITenantIsolationStrategy> strategies,
        IOptionsMonitor<MultiTenancySettings> settings)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(currentTenant);
        ArgumentNullException.ThrowIfNull(strategies);

        var tenantId = currentTenant.TenantId;
        var opts = settings.CurrentValue;
        var isAnonymous = context.User?.Identity?.IsAuthenticated != true;

        // Anonymous endpoints (health, swagger) flow through without tenant enforcement.
        if (!isAnonymous && opts.RequireResolvedTenant && tenantId is null)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsync("Tenant context is required for authenticated requests.").ConfigureAwait(false);
            return;
        }

        var strategy = strategies.FirstOrDefault(s => s.Mode == opts.IsolationMode);
        if (strategy is not null)
        {
            await strategy.ApplyAsync(tenantId, context.RequestAborted).ConfigureAwait(false);
        }

        using (LogContext.PushProperty("TenantId", tenantId?.ToString() ?? "(none)"))
        {
            await _next(context).ConfigureAwait(false);
        }
    }
}
