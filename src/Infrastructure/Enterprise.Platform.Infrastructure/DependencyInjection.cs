using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Application.Common.Interfaces;
using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Infrastructure.Configuration.Validation;
using Enterprise.Platform.Infrastructure.Caching;
using Enterprise.Platform.Infrastructure.Common;
using Enterprise.Platform.Infrastructure.Email;
using Enterprise.Platform.Infrastructure.FeatureFlags;
using Enterprise.Platform.Infrastructure.FileStorage;
using Enterprise.Platform.Infrastructure.Identity.Authorization;
using Enterprise.Platform.Infrastructure.Identity.Services;
using Enterprise.Platform.Infrastructure.Messaging.DomainEvents;
using Enterprise.Platform.Infrastructure.Messaging.IntegrationEvents;
using Enterprise.Platform.Infrastructure.PdfGeneration;
using Enterprise.Platform.Infrastructure.Persistence;
using Enterprise.Platform.Infrastructure.Resilience;
using Enterprise.Platform.Infrastructure.Security.DataEncryption;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

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

        // Settings binding with fail-fast validation (ValidateOnStart — the host aborts
        // build if config is invalid, so bad deployments never serve a single request).
        services.AddValidatedOptions<DatabaseSettings>(configuration, DatabaseSettings.SectionName);
        services.AddSingleton<IValidateOptions<DatabaseSettings>, DatabaseSettingsValidator>();

        services.AddValidatedOptions<AzureSettings>(configuration, AzureSettings.SectionName);

        services.AddValidatedOptions<CacheSettings>(configuration, CacheSettings.SectionName);
        services.AddSingleton<IValidateOptions<CacheSettings>, CacheSettingsValidator>();

        services.AddValidatedOptions<SmtpSettings>(configuration, SmtpSettings.SectionName);

        // Common services
        services.AddSingleton<IDateTimeProvider, SystemDateTimeProvider>();
        services.AddHttpContextAccessor();

        // Identity services (claims-backed; defer TokenService / LoginProtectionService to PlatformDb).
        // Registered Singleton because both services hold no request-scoped state — every
        // accessor reads live through IHttpContextAccessor (a singleton backed by AsyncLocal)
        // and IOptionsMonitor. Singleton lifetime is required for pooled DbContexts: their
        // `ApplicationServiceProvider` points at the root container (pool is a singleton), so
        // resolving these via `context.GetService<T>()` from inside OnModelCreating / save-time
        // interceptors would otherwise trip the scope validator with "Cannot resolve scoped
        // service from root provider."
        services.AddSingleton<ICurrentUserService, CurrentUserService>();

        // Claims-based authorization (RBAC + resource ownership).
        services.AddSingleton<IAuthorizationPolicyProvider, RbacPolicyProvider>();
        services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
        services.AddScoped<IAuthorizationHandler, ResourceOwnershipHandler>();

        // Domain-event dispatcher (in-process fan-out).
        services.AddScoped<IDomainEventDispatcher, DomainEventDispatcher>();

        // Integration events — outbox-backed publisher (persists with the caller's
        // transaction) + pluggable broker adapter (console logger by default; swap in
        // Azure Service Bus / RabbitMQ / Kafka when the real broker is provisioned).
        // The outbox schema is ensured at startup by OutboxSchemaBootstrapper.
        services.AddScoped<IIntegrationEventPublisher, OutboxIntegrationEventPublisher>();
        services.AddSingleton<IIntegrationEventBroker, ConsoleIntegrationEventBroker>();
        services.AddHostedService<Persistence.Outbox.OutboxSchemaBootstrapper>();

        // Resolve cache settings once — drives both the distributed-cache backend
        // choice (below) and the idempotency-store backend choice.
        var cacheSettings = configuration.GetSection(CacheSettings.SectionName).Get<CacheSettings>() ?? new CacheSettings();
        var useRedis = cacheSettings.Provider == CacheProvider.Redis
            && !string.IsNullOrWhiteSpace(cacheSettings.RedisConnectionString);

        // Null / in-memory / Redis behaviour dependencies — Phase-4 behaviors resolve
        // without PlatformDb. Idempotency store follows Cache:Provider so multi-instance
        // deployments automatically get cross-node atomic acquire semantics.
        services.AddScoped<IAuditWriter, NullAuditWriter>();
        if (useRedis)
        {
            services.AddSingleton<IIdempotencyStore, RedisIdempotencyStore>();
        }
        else
        {
            services.AddSingleton<IIdempotencyStore, InMemoryIdempotencyStore>();
        }

        // Persistence core
        services.AddSingleton<DbContextRegistry>();
        services.AddScoped<IDbContextFactory, DbContextFactory>();
        services.AddScoped<IDbConnectionFactory, DbConnectionFactory>();

        // NOTE: IUnitOfWork is intentionally NOT registered here.
        // `UnitOfWork<TContext>` is generic on a concrete DbContext; host/feature modules
        // bind the closed form (e.g. UnitOfWork<AppDbContext>) via AddAppDb.

        // Open-generic repository: DI closes both sides over the same T at resolve time.
#pragma warning disable CA2263 // Open-generic registration has no generic-overload equivalent.
        services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));
#pragma warning restore CA2263

        // Save-changes interceptors are attached directly in AddAppDb using `new`
        // instances. They hold no DI-resolvable deps (scoped services are resolved per-save
        // via `context.GetService<T>()` inside each interceptor), which is what makes them
        // safe to share across a pooled DbContext's slots.

        // Caching: Redis when Cache:Provider=Redis; InMemoryDistributedCache otherwise.
        // (Backend choice shares the `useRedis` flag computed above.)
        if (useRedis)
        {
            services.AddRedisDistributedCache(cacheSettings);
        }
        else
        {
            services.AddInMemoryDistributedCache();
        }

        services.AddScoped<CacheInvalidationService>();

        // P2-2 (audit) — region-prefix invalidator. Default is the no-op variant
        // that logs the request but doesn't physically evict (works for in-memory
        // cache where prefix scans aren't available). Replace with
        // RedisCacheRegionInvalidator when Redis is wired in production.
        services.AddSingleton<Application.Abstractions.Behaviors.ICacheRegionInvalidator, Caching.NoopCacheRegionInvalidator>();

        // Resilience: standard pipeline available under the "ep-standard" key.
        services.AddStandardResiliencePipeline();

        // Security: Azure Key Vault when configured, dev HKDF-derived keys otherwise.
        // Selection is static (config-time) — rotation in prod invalidates the cache
        // inside AzureKeyVaultKeyManagementService rather than re-registering.
        var azureSettings = configuration.GetSection(AzureSettings.SectionName).Get<AzureSettings>();
        if (!string.IsNullOrWhiteSpace(azureSettings?.KeyVaultUri))
        {
            services.AddSingleton<IKeyManagementService, AzureKeyVaultKeyManagementService>();
        }
        else
        {
            services.AddSingleton<IKeyManagementService, DevKeyManagementService>();
        }

        // File storage / email / feature flags — stubs/defaults. Prod hosts override.
        services.AddSingleton<IFileStorageService>(sp =>
        {
            var rootPath = configuration["FileStorage:Local:RootPath"]
                ?? Path.Combine(Path.GetTempPath(), "enterprise-platform");
            return new LocalFileStorageService(rootPath, sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<LocalFileStorageService>>());
        });
        services.AddScoped<IEmailService, SmtpEmailService>();
        services.AddSingleton<IFeatureFlagService, ConfigurationFeatureFlagService>();

        // PDF generation — placeholder; swap NotImplementedPdfGenerator for the
        // chosen real engine (QuestPDF / PuppeteerSharp / IronPDF) when the first
        // real PDF requirement lands. The abstraction is in Application/Common/
        // Interfaces/IPdfGenerator.cs so handlers can take the dependency today.
        services.AddSingleton<IPdfGenerator, NotImplementedPdfGenerator>();

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
