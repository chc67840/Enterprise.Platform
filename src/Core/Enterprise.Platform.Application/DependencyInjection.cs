using System.Reflection;
using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Behaviors;
using Enterprise.Platform.Application.Dispatcher;
using Enterprise.Platform.Contracts.Settings;
using FluentValidation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Enterprise.Platform.Application;

/// <summary>
/// DI composition root for the Application tier. Api / Worker hosts call
/// <see cref="AddApplication"/> once at startup; this method registers the
/// dispatcher, behaviors (in pipeline order), handlers, and validators.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Registers Application-tier services. Binds <see cref="MultiTenancySettings"/>
    /// and <see cref="CacheSettings"/> from configuration so behaviors can read them
    /// via <c>IOptions&lt;T&gt;</c>; infrastructure registers other settings.
    /// </summary>
    /// <param name="services">DI collection.</param>
    /// <param name="configuration">Root configuration.</param>
    public static IServiceCollection AddApplication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var applicationAssembly = typeof(DependencyInjection).Assembly;

        services.AddOptions<MultiTenancySettings>()
            .Bind(configuration.GetSection(MultiTenancySettings.SectionName));

        services.AddOptions<CacheSettings>()
            .Bind(configuration.GetSection(CacheSettings.SectionName));

        services.AddScoped<IDispatcher, Dispatcher.Dispatcher>();

        // Pipeline — registration order = execution order (outermost first).
        // CacheInvalidation sits *outside* Transaction so eviction only runs after a
        // successful commit — otherwise a rolled-back handler would invalidate cache
        // that was still correct.
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(TenantFilterBehavior<,>));
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(AuditBehavior<,>));
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(CacheInvalidationBehavior<,>));
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(TransactionBehavior<,>));
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(CachingBehavior<,>));
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(IdempotencyBehavior<,>));

        RegisterHandlers(services, applicationAssembly);

        services.AddValidatorsFromAssembly(applicationAssembly, includeInternalTypes: true);

        return services;
    }

    private static void RegisterHandlers(IServiceCollection services, Assembly assembly)
    {
        var handlerInterfaces = new[]
        {
            typeof(ICommandHandler<>),
            typeof(ICommandHandler<,>),
            typeof(IQueryHandler<,>),
        };

        foreach (var type in assembly.GetExportedTypes().Where(t => t is { IsClass: true, IsAbstract: false }))
        {
            foreach (var implemented in type.GetInterfaces())
            {
                if (!implemented.IsGenericType)
                {
                    continue;
                }

                var openGeneric = implemented.GetGenericTypeDefinition();
                if (Array.IndexOf(handlerInterfaces, openGeneric) < 0)
                {
                    continue;
                }

                services.AddScoped(implemented, type);
            }
        }
    }
}
