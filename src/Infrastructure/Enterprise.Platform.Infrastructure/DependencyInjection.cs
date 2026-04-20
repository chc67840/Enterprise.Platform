using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Application.Common.Interfaces;
using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Infrastructure.Caching;
using Enterprise.Platform.Infrastructure.Common;
using Enterprise.Platform.Infrastructure.Email;
using Enterprise.Platform.Infrastructure.FeatureFlags;
using Enterprise.Platform.Infrastructure.FileStorage;
using Enterprise.Platform.Infrastructure.Identity.Authorization;
using Enterprise.Platform.Infrastructure.Identity.Services;
using Enterprise.Platform.Infrastructure.Messaging.DomainEvents;
using Enterprise.Platform.Infrastructure.Messaging.IntegrationEvents;
using Enterprise.Platform.Infrastructure.MultiTenancy;
using Enterprise.Platform.Infrastructure.Persistence;
using Enterprise.Platform.Infrastructure.Persistence.Interceptors;
using Enterprise.Platform.Infrastructure.Resilience;
using Enterprise.Platform.Infrastructure.Security.DataEncryption;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
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

        // Settings binding (bind here; consumers resolve via IOptions<T>).
        services.AddOptions<DatabaseSettings>().Bind(configuration.GetSection(DatabaseSettings.SectionName));
        services.AddOptions<MultiTenancySettings>().Bind(configuration.GetSection(MultiTenancySettings.SectionName));
        services.AddOptions<AzureSettings>().Bind(configuration.GetSection(AzureSettings.SectionName));
        services.AddOptions<CacheSettings>().Bind(configuration.GetSection(CacheSettings.SectionName));
        services.AddOptions<SmtpSettings>().Bind(configuration.GetSection(SmtpSettings.SectionName));

        // Common services
        services.AddSingleton<IDateTimeProvider, SystemDateTimeProvider>();
        services.AddHttpContextAccessor();

        // Identity services (claims-backed; defer TokenService / LoginProtectionService to PlatformDb).
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<ICurrentTenantService, CurrentTenantService>();

        // Claims-based authorization (RBAC + resource ownership).
        services.AddSingleton<IAuthorizationPolicyProvider, RbacPolicyProvider>();
        services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
        services.AddScoped<IAuthorizationHandler, ResourceOwnershipHandler>();

        // Multi-tenancy isolation strategies (only SharedDatabase is active).
        services.AddScoped<ITenantIsolationStrategy, SharedDatabaseTenantStrategy>();

        // Domain-event dispatcher (in-process fan-out).
        services.AddScoped<IDomainEventDispatcher, DomainEventDispatcher>();

        // Integration-event publisher placeholder until PlatformDb + outbox land.
        services.AddSingleton<IIntegrationEventPublisher, NullIntegrationEventPublisher>();

        // Null / in-memory behaviour dependencies — Phase-4 behaviors resolve without PlatformDb.
        // `InMemoryIdempotencyStore` gives real at-most-once semantics in dev + single-instance
        // prod (H3 hardening); multi-instance deployments swap for a Redis-backed impl.
        services.AddScoped<IAuditWriter, NullAuditWriter>();
        services.AddSingleton<IIdempotencyStore, InMemoryIdempotencyStore>();

        // Persistence core
        services.AddSingleton<DbContextRegistry>();
        services.AddScoped<IDbContextFactory, DbContextFactory>();
        services.AddScoped<IDbConnectionFactory, DbConnectionFactory>();

        // NOTE: IUnitOfWork is intentionally NOT registered here.
        // `UnitOfWork<TContext>` is generic on a concrete DbContext; host/feature modules
        // bind the closed form (e.g. UnitOfWork<EventShopperDbContext>) via AddEventShopperDb.

        // Open-generic repository: DI closes both sides over the same T at resolve time.
#pragma warning disable CA2263 // Open-generic registration has no generic-overload equivalent.
        services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));
#pragma warning restore CA2263

        // Save-changes interceptors — dependencies now resolvable, so they're safe to attach in AddEventShopperDb.
        services.AddTransient<AuditableEntityInterceptor>();
        services.AddTransient<SoftDeleteInterceptor>();
        services.AddTransient<TenantQueryFilterInterceptor>();
        services.AddTransient<DomainEventDispatchInterceptor>();

        // Caching: in-memory distributed cache by default. Hosts in prod swap to Redis
        // via Caching.RedisCacheProvider.AddRedisDistributedCache(settings) from their composition root.
        services.AddInMemoryDistributedCache();
        services.AddScoped<CacheInvalidationService>();

        // Resilience: standard pipeline available under the "ep-standard" key.
        services.AddStandardResiliencePipeline();

        // Security: dev key-management service. Prod hosts swap for a Key Vault-backed impl.
        services.AddSingleton<IKeyManagementService, DevKeyManagementService>();

        // File storage / email / feature flags — stubs/defaults. Prod hosts override.
        services.AddSingleton<IFileStorageService>(sp =>
        {
            var rootPath = configuration["FileStorage:Local:RootPath"]
                ?? Path.Combine(Path.GetTempPath(), "enterprise-platform");
            return new LocalFileStorageService(rootPath, sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<LocalFileStorageService>>());
        });
        services.AddScoped<IEmailService, SmtpEmailService>();
        services.AddSingleton<IFeatureFlagService, ConfigurationFeatureFlagService>();

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
