using Enterprise.Platform.Application.Features.EventShopper.Roles.Repositories;
using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper.Contexts;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper.Mappings;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper.Repositories;
using Enterprise.Platform.Infrastructure.Persistence.Interceptors;
using Mapster;
using MapsterMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper;

/// <summary>
/// Composition root for the EventShopperDb target. Wires the scaffolded
/// <see cref="EventShopperDbContext"/>, registers it with the
/// <c>DbContextRegistry</c> under the logical name <c>"EventShopper"</c>, and binds
/// <see cref="IUnitOfWork"/> to <see cref="UnitOfWork{TContext}"/> closed over
/// <see cref="EventShopperDbContext"/>.
/// </summary>
/// <remarks>
/// Phase-7 update: the four save-changes interceptors are now attached via
/// <c>AddInterceptors</c>. EventShopperDb entities are raw DB-first POCOs that do
/// not implement the audit / tenant / aggregate-root marker interfaces, so the
/// interceptors no-op against them — but attaching them now means future entities
/// that do implement the markers get the behavior for free, and the wiring stays
/// symmetric with any future PlatformDb context.
/// </remarks>
public static class EventShopperServiceCollectionExtensions
{
    /// <summary>Logical database name for the EventShopperDb connection.</summary>
    public const string LogicalName = "EventShopper";

    /// <summary>Connection-string key in <c>appsettings.json:ConnectionStrings</c>.</summary>
    public const string ConnectionStringName = "EventShopperDb";

    /// <summary>
    /// Registers <see cref="EventShopperDbContext"/>, the closed-over unit of work,
    /// and the Mapster registry produced by DtoGen.
    /// </summary>
    public static IServiceCollection AddEventShopperDb(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException(
                $"Connection string '{ConnectionStringName}' is missing from configuration.");

        services.AddDbContext<EventShopperDbContext>((sp, options) =>
        {
            options.UseSqlServer(connectionString, sql =>
            {
                sql.MigrationsAssembly(typeof(EventShopperDbContext).Assembly.GetName().Name);
                // NOTE: `EnableRetryOnFailure` is intentionally NOT set. The Phase-4
                // TransactionBehavior opens user-initiated transactions which the
                // SqlServerRetryingExecutionStrategy refuses to wrap. Retry lives at a
                // higher level (Polly via ResiliencePipelineSetup) or via explicit
                // `Database.CreateExecutionStrategy().ExecuteAsync(...)` in handlers
                // that need retryable transactional units.
            });

            // Phase-7 wiring: attach save-changes interceptors now that their
            // dependencies (ICurrentUserService / ICurrentTenantService /
            // IDomainEventDispatcher) are registered in AddInfrastructure.
            options.AddInterceptors(
                sp.GetRequiredService<AuditableEntityInterceptor>(),
                sp.GetRequiredService<SoftDeleteInterceptor>(),
                sp.GetRequiredService<TenantQueryFilterInterceptor>(),
                sp.GetRequiredService<DomainEventDispatchInterceptor>());
        });

        services.RegisterDbContext<EventShopperDbContext>(LogicalName, isDefault: true);

        // UnitOfWork: closed-over form now that a concrete context exists.
        services.AddScoped<IUnitOfWork, UnitOfWork<EventShopperDbContext>>();

        // Mapster: a dedicated config (not GlobalSettings) so tests stay hermetic.
        services.TryAddSingleton(_ =>
        {
            var config = new TypeAdapterConfig();
            config.Scan(typeof(EventShopperMappingRegistry).Assembly);
            return config;
        });

        services.TryAddScoped<IMapper, ServiceMapper>();

        // Per-aggregate repositories — DB-first entities don't satisfy T : BaseEntity,
        // so the Phase-5 open-generic IGenericRepository<T> isn't applicable here.
        services.AddScoped<IRolesRepository, RolesRepository>();
        // TODO (Phase 9+): add each scaffolded aggregate's repository registration.

        return services;
    }
}
