using Enterprise.Platform.Application;
using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Infrastructure;
using Enterprise.Platform.Infrastructure.Observability;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper;
using Enterprise.Platform.Worker.Jobs;
using Serilog;

// Bootstrap Serilog so startup errors get captured before the full host is built.
var observability = new ObservabilitySettings();
var bootstrapLogger = StructuredLoggingSetup.BuildSerilogConfiguration(
        new ConfigurationBuilder().AddEnvironmentVariables().Build(),
        observability)
    .CreateBootstrapLogger();
Log.Logger = bootstrapLogger;

try
{
    var builder = Host.CreateApplicationBuilder(args);

    builder.Configuration
        .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
        .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
        .AddEnvironmentVariables();

    observability = builder.Configuration.GetSection(ObservabilitySettings.SectionName).Get<ObservabilitySettings>()
        ?? new ObservabilitySettings();

    builder.Services.AddSerilog((_, loggerConfig) =>
    {
        var config = StructuredLoggingSetup.BuildSerilogConfiguration(builder.Configuration, observability);
        loggerConfig.WriteTo.Logger(config.CreateLogger());
    });

    // Core services (dispatcher, behaviors, handlers, repos, DbContext).
    builder.Services.AddApplication(builder.Configuration);
    builder.Services.AddInfrastructure(builder.Configuration);
    builder.Services.AddEventShopperDb(builder.Configuration);
    builder.Services.AddPlatformOpenTelemetry(observability);

    // Background jobs.
    //
    // CacheWarmupJob is active. OutboxProcessorJob + AuditRetentionJob are
    // placeholders until PlatformDb lands (per D4) — commented out intentionally
    // so their no-op loops don't pretend to do work.
    builder.Services.AddHostedService<CacheWarmupJob>();
    // builder.Services.AddHostedService<OutboxProcessorJob>();   // activate with PlatformDb
    // builder.Services.AddHostedService<AuditRetentionJob>();    // activate with PlatformDb

    var host = builder.Build();

    Log.Information(
        "Enterprise.Platform.Worker starting — environment={Environment}.",
        host.Services.GetRequiredService<IHostEnvironment>().EnvironmentName);
    await host.RunAsync().ConfigureAwait(false);
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Enterprise.Platform.Worker terminated unexpectedly.");
    throw;
}
finally
{
    await Log.CloseAndFlushAsync().ConfigureAwait(false);
}
