namespace Enterprise.Platform.Contracts.Settings;

/// <summary>
/// Root application metadata — name, environment, version. Bound from the
/// <c>"App"</c> configuration section. Kept deliberately small; anything environmental
/// (endpoints, keys) belongs in a dedicated settings class (<see cref="AzureSettings"/>,
/// <see cref="JwtSettings"/>, etc.).
/// </summary>
public sealed class AppSettings
{
    /// <summary>Configuration section name — <c>App</c>.</summary>
    public const string SectionName = "App";

    /// <summary>
    /// Public-facing application name. Surfaces in OpenAPI, structured logs, and email
    /// templates. Keep stable across environments.
    /// </summary>
    public string Name { get; set; } = "Enterprise.Platform";

    /// <summary>
    /// Deployment environment label — <c>Development</c>, <c>Staging</c>, <c>Production</c>, etc.
    /// Typically read from <c>ASPNETCORE_ENVIRONMENT</c> rather than bound, but exposed here
    /// for tools (emailers, log enrichers) that need it without a <c>IHostEnvironment</c>.
    /// </summary>
    public string Environment { get; set; } = "Development";

    /// <summary>
    /// Semantic version of the running build. Injected during CI from the assembly version
    /// or git tag. Surfaces in the <c>/health</c> endpoint and OpenTelemetry resource.
    /// </summary>
    public string Version { get; set; } = "0.0.0";

    /// <summary>
    /// Optional long-form description — used by OpenAPI and the landing page. Leave blank
    /// if not needed.
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// When <c>true</c>, developer-only features (Swagger UI, detailed errors) may be
    /// enabled by the host. Never set <c>true</c> in Production.
    /// </summary>
    public bool DeveloperMode { get; set; }
}
