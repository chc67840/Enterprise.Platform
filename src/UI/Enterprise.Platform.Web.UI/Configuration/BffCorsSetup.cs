using Enterprise.Platform.Contracts.Settings;

namespace Enterprise.Platform.Web.UI.Configuration;

/// <summary>
/// CORS for the BFF. The BFF serves the SPA from the same origin in typical
/// deployments (no CORS needed), but dev hosts often split BFF + Angular
/// <c>ng serve</c> across ports — this policy covers that case. Reuses the shared
/// <see cref="CorsSettings"/> POCO so Api + BFF share the same origin list.
/// </summary>
public static class BffCorsSetup
{
    /// <summary>Default policy name used by the BFF.</summary>
    public const string PolicyName = "ep-bff";

    /// <summary>Registers the BFF CORS policy.</summary>
    public static IServiceCollection AddBffCors(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var settings = configuration.GetSection(CorsSettings.SectionName).Get<CorsSettings>() ?? new CorsSettings();

        services.AddCors(options =>
        {
            options.AddPolicy(PolicyName, policy =>
            {
                if (settings.AllowedOrigins.Count > 0)
                {
                    policy.WithOrigins([.. settings.AllowedOrigins]);
                }

                policy.WithMethods([.. settings.AllowedMethods]);
                policy.WithHeaders([.. settings.AllowedHeaders]);
                policy.WithExposedHeaders([.. settings.ExposedHeaders]);

                if (settings.AllowCredentials && settings.AllowedOrigins.Count > 0)
                {
                    policy.AllowCredentials();
                }
            });
        });

        return services;
    }
}
