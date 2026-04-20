using System.Globalization;
using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.Configuration;
using Serilog;
using Serilog.Events;

namespace Enterprise.Platform.Infrastructure.Observability;

/// <summary>
/// Serilog composition helper. Hosts call this from <c>Program.cs</c> before
/// <c>builder.Build()</c>. Sinks: Console (always), Seq (when
/// <see cref="ObservabilitySettings.SeqEndpoint"/> is populated). Enrichers: machine
/// name, thread id, correlation/tenant/user ids from <c>LogContext</c>.
/// </summary>
public static class StructuredLoggingSetup
{
    /// <summary>Configures the shared <c>Log.Logger</c>.</summary>
    public static LoggerConfiguration BuildSerilogConfiguration(
        IConfiguration configuration,
        ObservabilitySettings settings)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(settings);

        var loggerConfig = new LoggerConfiguration()
            .ReadFrom.Configuration(configuration)
            .Enrich.FromLogContext()
            .Enrich.WithMachineName()
            .Enrich.WithThreadId()
            .Enrich.WithProperty("ServiceName", settings.ServiceName)
            .Enrich.WithProperty("ServiceVersion", settings.ServiceVersion)
            .MinimumLevel.Debug()
            .MinimumLevel.Override("Microsoft", LogEventLevel.Information)
            .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
            .MinimumLevel.Override("System", LogEventLevel.Warning)
            .WriteTo.Console(formatProvider: CultureInfo.InvariantCulture);

        if (!string.IsNullOrWhiteSpace(settings.SeqEndpoint))
        {
            loggerConfig = loggerConfig.WriteTo.Seq(
                serverUrl: settings.SeqEndpoint,
                formatProvider: CultureInfo.InvariantCulture);
        }

        return loggerConfig;
    }
}
