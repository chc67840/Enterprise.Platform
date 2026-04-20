using Enterprise.Platform.Api.Extensions;
using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Infrastructure.Configuration;
using Enterprise.Platform.Infrastructure.Observability;
using Serilog;

// Bootstrap Serilog before the host builder so startup errors get captured.
var observability = new ObservabilitySettings();
var bootstrapLogger = StructuredLoggingSetup.BuildSerilogConfiguration(
        new ConfigurationBuilder().AddEnvironmentVariables().Build(),
        observability)
    .CreateBootstrapLogger();
Log.Logger = bootstrapLogger;

try
{
    var builder = WebApplication.CreateBuilder(args);

    // Layered configuration sources. Azure Key Vault is appended last (wins over
    // appsettings + env vars) when `Azure:KeyVaultUri` is populated; no-op otherwise.
    builder.Configuration
        .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
        .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
        .AddEnvironmentVariables()
        .AddPlatformKeyVaultIfConfigured();

    observability = builder.Configuration.GetSection(ObservabilitySettings.SectionName).Get<ObservabilitySettings>()
        ?? new ObservabilitySettings();

    builder.Host.UseSerilog((context, _, loggerConfig) =>
    {
        var config = StructuredLoggingSetup.BuildSerilogConfiguration(context.Configuration, observability);
        loggerConfig.WriteTo.Logger(config.CreateLogger());
    });

    // Services
    builder.Services.AddPlatformApi(builder.Configuration);
    builder.Services.AddPlatformOpenTelemetry(observability);

    // Pipeline
    var app = builder.Build();
    app.UsePlatformPipeline();

    Log.Information("Enterprise.Platform API starting — environment={Environment}.", app.Environment.EnvironmentName);
    await app.RunAsync().ConfigureAwait(false);
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Enterprise.Platform API terminated unexpectedly.");
    throw;
}
finally
{
    await Log.CloseAndFlushAsync().ConfigureAwait(false);
}
