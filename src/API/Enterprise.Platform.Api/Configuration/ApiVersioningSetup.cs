using Asp.Versioning;

namespace Enterprise.Platform.Api.Configuration;

/// <summary>
/// Composes Api versioning via <c>Asp.Versioning</c>. Versions are surfaced through:
/// URL segment (<c>/api/v{version}/...</c>) + header (<c>X-API-Version</c>) as a
/// fallback. Default version is <c>1.0</c>; breaking changes bump the major.
/// </summary>
public static class ApiVersioningSetup
{
    /// <summary>Registers the versioning services.</summary>
    public static IServiceCollection AddPlatformApiVersioning(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddApiVersioning(options =>
        {
            options.DefaultApiVersion = new ApiVersion(1, 0);
            options.AssumeDefaultVersionWhenUnspecified = true;
            options.ReportApiVersions = true;
            options.ApiVersionReader = ApiVersionReader.Combine(
                new UrlSegmentApiVersionReader(),
                new HeaderApiVersionReader(Shared.Constants.HttpHeaderNames.ApiVersion));
        });

        // Note: `.AddApiExplorer(...)` requires Asp.Versioning.Mvc.ApiExplorer which is
        // MVC-coupled. Minimal-API endpoints feed OpenAPI via metadata directly, so we
        // skip it here. Add the package + extension only if an MVC controller surface appears.
        return services;
    }
}
