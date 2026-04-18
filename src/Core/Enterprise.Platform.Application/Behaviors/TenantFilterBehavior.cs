using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Domain.Exceptions;
using Enterprise.Platform.Domain.Interfaces;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Application.Behaviors;

/// <summary>
/// Pipeline order 3 — guards tenant resolution. When <see cref="MultiTenancySettings.RequireResolvedTenant"/>
/// is <c>true</c> and <see cref="ICurrentTenantService.TenantId"/> is <c>null</c>, the
/// behavior short-circuits with <see cref="TenantMismatchException"/>. For anonymous
/// endpoints that legitimately have no tenant, mark the command / query with a
/// dedicated interface (future work) or configure <c>RequireResolvedTenant = false</c>.
/// </summary>
public sealed class TenantFilterBehavior<TRequest, TResponse>(
    ICurrentTenantService currentTenantService,
    IOptions<MultiTenancySettings> options)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly MultiTenancySettings _settings = options.Value;

    /// <inheritdoc />
    public Task<TResponse> HandleAsync(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(next);

        if (_settings.RequireResolvedTenant && currentTenantService.TenantId is null)
        {
            throw new TenantMismatchException(
                "No tenant was resolved for this request but the platform is configured to require one.");
        }

        return next();
    }
}
