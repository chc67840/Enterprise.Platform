using Enterprise.Platform.Api.Configuration;
using Enterprise.Platform.Api.Filters;
using Enterprise.Platform.Application;
using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Infrastructure;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper;

namespace Enterprise.Platform.Api.Extensions;

/// <summary>
/// Composes Application + Infrastructure + Api-tier services into a single
/// <see cref="IServiceCollection"/>. <c>Program.cs</c> calls
/// <see cref="AddPlatformApi"/> and nothing else; the extension fans out to each
/// layer's own <c>AddXxx</c> helper so ordering stays explicit.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>Wires every platform service the Api host needs.</summary>
    public static IServiceCollection AddPlatformApi(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        // Bind settings sections consumed by Api helpers (Infrastructure binds the rest).
        services.AddOptions<JwtSettings>().Bind(configuration.GetSection(JwtSettings.SectionName));
        services.AddOptions<CorsSettings>().Bind(configuration.GetSection(CorsSettings.SectionName));
        services.AddOptions<RateLimitSettings>().Bind(configuration.GetSection(RateLimitSettings.SectionName));
        services.AddOptions<ObservabilitySettings>().Bind(configuration.GetSection(ObservabilitySettings.SectionName));

        // Core tiers
        services.AddApplication(configuration);
        services.AddInfrastructure(configuration);
        services.AddEventShopperDb(configuration);

        // Api tier — authentication signature changed in H9 to read the full config
        // (Entra B2B + B2C + symmetric-key fallback all live in appsettings).
        services.AddPlatformAuthentication(configuration);
        services.AddPlatformApiVersioning();
        services.AddPlatformOpenApi();
        services.AddPlatformHealthChecks();
        services.AddPlatformRateLimiting();
        services.AddPlatformCompression();

        // CORS: per-environment origins from CorsSettings.
        var corsSettings = configuration.GetSection(CorsSettings.SectionName).Get<CorsSettings>() ?? new CorsSettings();
        services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                if (corsSettings.AllowedOrigins.Count > 0)
                {
                    policy.WithOrigins([.. corsSettings.AllowedOrigins]);
                }

                policy.WithMethods([.. corsSettings.AllowedMethods]);
                policy.WithHeaders([.. corsSettings.AllowedHeaders]);
                policy.WithExposedHeaders([.. corsSettings.ExposedHeaders]);
                if (corsSettings.AllowCredentials && corsSettings.AllowedOrigins.Count > 0)
                {
                    policy.AllowCredentials();
                }
            });
        });

        // Shared endpoint filters — consumed by minimal-API route groups.
        services.AddScoped<LogEndpointFilter>();
        services.AddScoped<IdempotencyEndpointFilter>();

        return services;
    }
}
