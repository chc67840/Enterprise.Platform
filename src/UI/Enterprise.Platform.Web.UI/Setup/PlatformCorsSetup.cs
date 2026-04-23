using Enterprise.Platform.Contracts.Settings;

namespace Enterprise.Platform.Web.UI.Setup;

/// <summary>
/// CORS policy registration for the Web.UI host. Same-origin SPA hosting
/// means CORS is mostly unused at runtime; the policy exists for the rare
/// dev scenarios where another tool (Postman collection, Storybook, etc.)
/// needs to reach the host from a different origin.
/// </summary>
public static class PlatformCorsSetup
{
    /// <summary>Default CORS policy name used by the host.</summary>
    public const string PolicyName = "ep-web-ui";

    /// <summary>Registers the host's CORS policy.</summary>
    public static IServiceCollection AddPlatformCors(
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
