using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Infrastructure.Persistence.App.Contexts;
using Enterprise.Platform.Infrastructure.Persistence.App.Mappings;
using Enterprise.Platform.Infrastructure.Persistence.App.Repositories;
using Enterprise.Platform.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Enterprise.Platform.Infrastructure.Persistence.App;

/// <summary>
/// Composition root for the <see cref="AppDbContext"/>. Wires the pooled context,
/// registers it with <c>DbContextRegistry</c> as the default logical name
/// <c>"App"</c>, binds <see cref="IUnitOfWork"/> to <see cref="UnitOfWork{TContext}"/>
/// closed over <see cref="AppDbContext"/>, and adds the DtoGen-emitted IMapper
/// covering every App entity ↔ DTO pair.
/// </summary>
/// <remarks>
/// <para>
/// <b>Pooled context.</b> Instances are recycled across requests to avoid
/// per-request allocation + metadata-compile cost. The interceptors attached
/// here are safe to share across pool slots because they hold no
/// constructor-captured scoped services — every save resolves
/// <see cref="IDateTimeProvider"/> / <see cref="ICurrentUserService"/> /
/// <see cref="IDomainEventDispatcher"/> via <c>context.GetService&lt;T&gt;()</c>,
/// so principal correctness tracks the live request.
/// </para>
/// <para>
/// <b>Why <c>EnableRetryOnFailure</c> is intentionally NOT set.</b> The Phase-4
/// <c>TransactionBehavior</c> opens user-initiated transactions which the
/// <c>SqlServerRetryingExecutionStrategy</c> refuses to wrap. Retry lives at a
/// higher level (Polly via <c>ResiliencePipelineSetup</c>) or via explicit
/// <c>Database.CreateExecutionStrategy().ExecuteAsync(...)</c> in handlers that
/// need retryable transactional units. Adding the flag here would break the
/// transactional boundary contract assumed by every command handler.
/// </para>
/// </remarks>
public static class AppServiceCollectionExtensions
{
    /// <summary>Logical database name registered with the <c>DbContextRegistry</c>.</summary>
    public const string LogicalName = "App";

    /// <summary>Connection-string key in <c>appsettings.json:ConnectionStrings</c>.</summary>
    public const string ConnectionStringName = "AppDb";

    /// <summary>
    /// Default pool capacity. EF Core's built-in default is 1024; surfaced as a
    /// constant so the number is visible alongside the registration and can be
    /// overridden per host if needed.
    /// </summary>
    private const int DefaultPoolSize = 1024;

    /// <summary>
    /// Registers <see cref="AppDbContext"/> (pooled), the closed-over unit of
    /// work, the DtoGen-emitted <see cref="Contracts.Abstractions.Mapping.IMapper"/>,
    /// and per-aggregate repositories.
    /// </summary>
    public static IServiceCollection AddAppDb(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException(
                $"Connection string '{ConnectionStringName}' is missing from configuration.");

        services.AddDbContextPool<AppDbContext>(options =>
        {
            options.UseSqlServer(connectionString, sql =>
            {
                sql.MigrationsAssembly(typeof(AppDbContext).Assembly.GetName().Name);
                // EnableRetryOnFailure intentionally OMITTED — see class remarks.
            });

            // Save-changes interceptors — three-stack covering audit, soft-delete, domain events.
            options.AddInterceptors(
                new AuditableEntityInterceptor(),
                new SoftDeleteInterceptor(),
                new DomainEventDispatchInterceptor());
        }, poolSize: DefaultPoolSize);

        services.RegisterDbContext<AppDbContext>(LogicalName, isDefault: true);

        // UnitOfWork: closed over the concrete context.
        services.AddScoped<IUnitOfWork, UnitOfWork<AppDbContext>>();

        // P2-6 (audit) — read-only context surface with AsNoTracking enforced
        // at the adapter so handlers can't accidentally materialise tracked
        // entities through the read path.
        services.AddScoped<IReadDbContext>(sp =>
            new ReadDbContextAdapter<AppDbContext>(sp.GetRequiredService<AppDbContext>()));

        // Object mapping — DtoGen-emitted IMapper façade. AddAppMappers registers
        // one entry per scaffolded entity. Idempotent; safe to call from
        // multiple composition roots in a multi-DB host.
        services.AddAppMappers();

        // Per-aggregate repositories. Each method MUST NOT call SaveChangesAsync
        // (P0-2 audit) — TransactionBehavior in the MediatR pipeline owns the
        // unit-of-work flush.
        services.AddScoped<IUserRepository, UserRepository>();

        return services;
    }
}
