using Enterprise.Platform.Api.Configuration;
using Enterprise.Platform.Api.Filters;
using Enterprise.Platform.Application;
using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Infrastructure;
using Enterprise.Platform.Infrastructure.Configuration.Validation;
using Enterprise.Platform.Infrastructure.Persistence.App;
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.Extensions.Options;

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

        // Bind settings sections consumed by Api helpers with ValidateOnStart — the
        // host fails to build if any Api-tier config is invalid. Infrastructure binds
        // the rest with the same pattern.
        services.AddValidatedOptions<JwtSettings>(configuration, JwtSettings.SectionName);
        services.AddSingleton<IValidateOptions<JwtSettings>, JwtSettingsValidator>();

        services.AddValidatedOptions<CorsSettings>(configuration, CorsSettings.SectionName);
        services.AddSingleton<IValidateOptions<CorsSettings>, CorsSettingsValidator>();
        services.AddValidatedOptions<RateLimitSettings>(configuration, RateLimitSettings.SectionName);
        services.AddValidatedOptions<ObservabilitySettings>(configuration, ObservabilitySettings.SectionName);

        // Entra settings — AuthenticationSetup binds them too (different code path),
        // but adding the cross-property validator here ensures startup fails fast when
        // an `Enabled=true` config is incomplete.
        services.AddSingleton<IValidateOptions<EntraIdSettings>, EntraIdSettingsValidator>();
        services.AddSingleton<IValidateOptions<EntraIdB2CSettings>, EntraIdB2CSettingsValidator>();

        // Core tiers
        services.AddApplication(configuration);
        services.AddInfrastructure(configuration);
        services.AddAppDb(configuration);

        // Api tier — authentication signature changed in H9 to read the full config
        // (Entra B2B + B2C + symmetric-key fallback all live in appsettings).
        services.AddPlatformAuthentication(configuration);
        services.AddPlatformApiVersioning();
        services.AddPlatformOpenApi();
        services.AddPlatformHealthChecks();
        services.AddPlatformRateLimiting();
        services.AddPlatformCompression();

        // P1-7 (audit) — global request-timeout policy. Without this, a slow
        // database query or hung handler can hold a thread-pool worker for the
        // duration of the client connection, which under scale-out exhausts the
        // pool. 30 s default fits the 99th-percentile of well-behaved handlers;
        // long-running ops (file-export, batch ingest) opt out per-endpoint via
        // `[RequestTimeout(...)]` or `MapXxx(...).WithRequestTimeout(...)`.
        services.AddRequestTimeouts(options =>
        {
            options.DefaultPolicy = new RequestTimeoutPolicy
            {
                Timeout = TimeSpan.FromSeconds(30),
                TimeoutStatusCode = StatusCodes.Status504GatewayTimeout,
            };
        });

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
