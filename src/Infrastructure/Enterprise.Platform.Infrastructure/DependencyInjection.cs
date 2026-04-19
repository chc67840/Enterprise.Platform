using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Application.Common.Interfaces;
using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Infrastructure.Common;
using Enterprise.Platform.Infrastructure.Persistence;
using Enterprise.Platform.Infrastructure.Persistence.Interceptors;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Enterprise.Platform.Infrastructure;

/// <summary>
/// DI composition root for the Infrastructure tier. Phase 5 wires the persistence core
/// + common services; phases 7 onward extend this with caching, messaging, identity,
/// observability, resilience, etc. (see <c>Docs/Implementation/00-Foundation-TODO.md</c>).
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Registers persistence-core services. Concrete <c>DbContext</c> wiring is the
    /// caller's job (via <c>AddDbContext&lt;TContext&gt;</c> + a call to
    /// <see cref="RegisterDbContext{TContext}"/>); this method wires the
    /// framework-agnostic pieces so a host can bootstrap before any DB goes live.
    /// </summary>
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddOptions<DatabaseSettings>()
            .Bind(configuration.GetSection(DatabaseSettings.SectionName));

        // Common services
        services.AddSingleton<IDateTimeProvider, SystemDateTimeProvider>();

        // Persistence core
        services.AddSingleton<DbContextRegistry>();
        services.AddScoped<IDbContextFactory, DbContextFactory>();
        services.AddScoped<IDbConnectionFactory, DbConnectionFactory>();

        // NOTE: IUnitOfWork is intentionally NOT registered here.
        // `UnitOfWork<TContext>` is generic on a concrete DbContext; there's no valid
        // open-generic binding from the non-generic `IUnitOfWork` to `UnitOfWork<>`.
        // Host/feature modules register the closed-over form once they pick a context,
        // e.g.:  services.AddScoped<IUnitOfWork, UnitOfWork<EventShopperDbContext>>();
        // (this lands in Phase 6 when EventShopperDbContext is scaffolded).

        // Open-generic repository: DI closes both sides over the same T at resolve time.
#pragma warning disable CA2263 // Open-generic registration has no generic-overload equivalent.
        services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));
#pragma warning restore CA2263

        // Save-changes interceptors (registered transient; EF composes them per context via UseInterceptors).
        services.AddTransient<AuditableEntityInterceptor>();
        services.AddTransient<SoftDeleteInterceptor>();
        services.AddTransient<TenantQueryFilterInterceptor>();
        services.AddTransient<DomainEventDispatchInterceptor>();

        return services;
    }

    /// <summary>
    /// Registers a <typeparamref name="TContext"/> against <paramref name="logicalName"/>
    /// in the singleton <see cref="DbContextRegistry"/>. Call this <b>after</b>
    /// <c>AddDbContext&lt;TContext&gt;</c> so the context is resolvable from DI.
    /// Marking a registration as default lets <c>IDbContextFactory.GetContext&lt;T&gt;()</c>
    /// resolve without an explicit name.
    /// </summary>
    public static IServiceCollection RegisterDbContext<TContext>(
        this IServiceCollection services,
        string logicalName,
        bool isDefault = false)
        where TContext : Microsoft.EntityFrameworkCore.DbContext
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentException.ThrowIfNullOrWhiteSpace(logicalName);

        var registry = services
            .Where(d => d.ServiceType == typeof(DbContextRegistry))
            .Select(d => d.ImplementationInstance as DbContextRegistry)
            .FirstOrDefault(x => x is not null);

        if (registry is null)
        {
            registry = new DbContextRegistry();
            services.AddSingleton(registry);
        }

        registry.Register<TContext>(logicalName, isDefault);
        return services;
    }
}
