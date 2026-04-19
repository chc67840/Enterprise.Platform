using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper.Contexts;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper.Mappings;
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
/// Interceptor attachment is deliberately deferred. The four Phase-5 interceptors
/// (<c>AuditableEntityInterceptor</c>, <c>SoftDeleteInterceptor</c>,
/// <c>TenantQueryFilterInterceptor</c>, <c>DomainEventDispatchInterceptor</c>) carry
/// dependencies (<c>ICurrentUserService</c>, <c>ICurrentTenantService</c>,
/// <c>IDomainEventDispatcher</c>) whose implementations land in Phase 7. Attaching
/// them now would break DI composition. EventShopperDb entities are raw DB-first
/// POCOs that do not implement the audit / tenant markers, so the interceptors would
/// no-op against them anyway.
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

        services.AddDbContext<EventShopperDbContext>(options =>
        {
            options.UseSqlServer(connectionString, sql =>
            {
                sql.MigrationsAssembly(typeof(EventShopperDbContext).Assembly.GetName().Name);
                sql.EnableRetryOnFailure();
            });
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

        return services;
    }
}
