# 09 — Observability (Logging, Metrics, Tracing)

> **Output of this doc.** Three pillars wired identically across all hosts:
> structured logs (Serilog → Console + Seq), metrics + traces (OpenTelemetry
> → OTLP), and per-host health checks. Correlation IDs propagate end-to-end
> so a single browser request can be reconstructed across SPA, BFF, and Api logs.

## 1. Three pillars + their sinks

| Pillar | Library | Sinks |
|---|---|---|
| **Logs** | Serilog 9.0.0 | Console (always), Seq (when `ObservabilitySettings.SeqEndpoint` set), Application Insights (SPA only) |
| **Metrics** | `System.Diagnostics.Metrics` + OpenTelemetry 1.12.0 | OTLP exporter → collector / Prometheus / App Insights / Grafana |
| **Traces** | OpenTelemetry instrumentation (AspNetCore + Http + EF + SqlClient) | OTLP exporter → Jaeger / Tempo / App Insights |

## 2. Serilog composition (shared across hosts)

`src/Infrastructure/Enterprise.Platform.Infrastructure/Observability/StructuredLoggingSetup.cs`:

```csharp
public static class StructuredLoggingSetup
{
    public static LoggerConfiguration BuildSerilogConfiguration(
        IConfiguration configuration,
        ObservabilitySettings settings)
    {
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
            loggerConfig = loggerConfig.WriteTo.Seq(settings.SeqEndpoint);
        }

        return loggerConfig;
    }
}
```

Each host calls this twice in `Program.cs` — once before `Builder` (bootstrap
logger so failures during startup get logged) and once via `UseSerilog` after:

```csharp
// 1. Bootstrap logger — logs the very early stuff
var observability = new ObservabilitySettings();
var bootstrapLogger = StructuredLoggingSetup.BuildSerilogConfiguration(
        new ConfigurationBuilder().AddEnvironmentVariables().Build(),
        observability)
    .CreateBootstrapLogger();
Log.Logger = bootstrapLogger;

try
{
    var builder = WebApplication.CreateBuilder(args);

    // 2. Read the real settings (now we have configuration)
    builder.Configuration.AddJsonFile("appsettings.json", optional: true)...;
    observability = builder.Configuration
        .GetSection(ObservabilitySettings.SectionName)
        .Get<ObservabilitySettings>() ?? new ObservabilitySettings();

    // 3. Replace the bootstrap logger with the real one
    builder.Host.UseSerilog((context, _, loggerConfig) =>
    {
        var config = StructuredLoggingSetup.BuildSerilogConfiguration(
            context.Configuration, observability);
        loggerConfig.WriteTo.Logger(config.CreateLogger());
    });

    // ... rest of host setup
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Host terminated unexpectedly.");
    throw;
}
finally
{
    await Log.CloseAndFlushAsync();
}
```

### 2.1 Serilog enrichers active by default

| Enricher | Property added |
|---|---|
| `WithMachineName()` | `MachineName` |
| `WithThreadId()` | `ThreadId` |
| `FromLogContext()` | `CorrelationId`, `TenantId`, `UserId` (anything pushed via `LogContext.PushProperty`) |
| `WithProperty("ServiceName", ...)` | `ServiceName` (e.g. `enterprise-platform-api`) |
| `WithProperty("ServiceVersion", ...)` | `ServiceVersion` |

## 3. Source-generated logging (CA1848)

NEVER write `_logger.LogInformation("Foo {bar}", bar)` in production code —
it allocates on every call and CA1848 flags it as an error. Instead, use
`[LoggerMessage]` partial methods:

```csharp
public sealed partial class FooService(ILogger<FooService> logger)
{
    [LoggerMessage(EventId = 1234, Level = LogLevel.Information,
        Message = "Foo.Did.A.Thing — bar={Bar} (took {ElapsedMs}ms)")]
    private partial void LogFooDidAThing(string bar, long elapsedMs);

    public void DoTheThing(string bar)
    {
        var sw = Stopwatch.StartNew();
        // ... work ...
        LogFooDidAThing(bar, sw.ElapsedMilliseconds);
    }
}
```

The Roslyn source generator emits a zero-allocation logging delegate at
compile time. Performance: ~10× faster than the `LogInformation` overload.

### 3.1 Event ID ranges (BFF)

| Range | Class | Concern |
|---|---|---|
| 1001–1099 | `AuthController` | Login / logout / session / permissions / profile |
| 2001–2099 | `TokenRefreshService` | Refresh-token rotation lifecycle |
| 3001–3099 | `SecurityHeadersMiddleware` | (reserved) |
| 4001–4099 | `ProxyController` | Proxy hops |
| 5001–5099 | `GraphUserProfileService` | Graph fetch lifecycle |
| 6001–6099 | `OutboxProcessorJob` (Worker) | Outbox drain |

Document additions in the relevant class's header comment.

## 4. OpenTelemetry composition

`src/Infrastructure/Enterprise.Platform.Infrastructure/Observability/OpenTelemetrySetup.cs`:

```csharp
public static class OpenTelemetrySetup
{
    public static IServiceCollection AddPlatformOpenTelemetry(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var settings = configuration.GetSection(ObservabilitySettings.SectionName)
            .Get<ObservabilitySettings>() ?? new ObservabilitySettings();

        var resourceBuilder = ResourceBuilder.CreateDefault()
            .AddService(settings.ServiceName, serviceVersion: settings.ServiceVersion);

        services.AddOpenTelemetry()
            .ConfigureResource(r => r.AddService(settings.ServiceName, serviceVersion: settings.ServiceVersion))
            .WithTracing(t =>
            {
                t.SetSampler(new TraceIdRatioBasedSampler(settings.SamplingRatio));
                t.AddAspNetCoreInstrumentation();
                if (settings.EnableHttpInstrumentation)
                    t.AddHttpClientInstrumentation();
                if (settings.EnableDatabaseInstrumentation)
                {
                    t.AddSqlClientInstrumentation();
                    t.AddEntityFrameworkCoreInstrumentation();
                }

                if (!string.IsNullOrWhiteSpace(settings.OtelEndpoint))
                    t.AddOtlpExporter(opt => opt.Endpoint = new Uri(settings.OtelEndpoint));
            })
            .WithMetrics(m =>
            {
                m.AddAspNetCoreInstrumentation();
                if (settings.EnableHttpInstrumentation)
                    m.AddHttpClientInstrumentation();

                // Custom meters — register them by name here
                m.AddMeter(SessionMetrics.MeterName);    // BFF host
                m.AddMeter("Enterprise.Platform.Api");   // Api host (AudienceMatchMetric)

                if (!string.IsNullOrWhiteSpace(settings.OtelEndpoint))
                    m.AddOtlpExporter(opt => opt.Endpoint = new Uri(settings.OtelEndpoint));
            });

        return services;
    }
}
```

## 5. Custom metrics — `Counter<T>` + `Histogram<T>`

Pattern (already in BFF + Api):

```csharp
public sealed class SessionMetrics : IDisposable
{
    public const string MeterName = "Enterprise.Platform.Web.UI";
    private readonly Meter _meter;

    public Counter<long> SessionsCreated { get; }
    public Histogram<double> SessionLifetimeSeconds { get; }
    // ...

    public SessionMetrics(IMeterFactory meterFactory)
    {
        _meter = meterFactory.Create(MeterName);
        SessionsCreated = _meter.CreateCounter<long>(
            "ep.bff.session.created",
            unit: "{session}",
            description: "Sessions issued (OIDC sign-in completed).");
        SessionLifetimeSeconds = _meter.CreateHistogram<double>(
            "ep.bff.session.lifetime",
            unit: "s",
            description: "Session wall-clock lifetime.");
    }

    public void Dispose() => _meter.Dispose();
}
```

Registered as singleton; injected wherever instrumentation fires. **Cardinality
discipline:** tags must stay low-cardinality (status strings only). Never
tag with user id / tenant id — that's what traces are for.

### 5.1 Catalog (current)

| Meter / metric | Type | Tags | Source |
|---|---|---|---|
| `Enterprise.Platform.Web.UI` / `ep.bff.session.created` | Counter | — | BFF `OnSigningIn` |
| `Enterprise.Platform.Web.UI` / `ep.bff.session.refreshed` | Counter | — | BFF `TokenRefreshService` |
| `Enterprise.Platform.Web.UI` / `ep.bff.session.refresh_failed` | Counter | `reason` (missing_tokens / network / http_4xx / deserialize / empty_payload) | BFF `TokenRefreshService` |
| `Enterprise.Platform.Web.UI` / `ep.bff.session.lifetime` | Histogram (s) | `reason` (signout) | BFF `OnSigningOut` |
| `Enterprise.Platform.Api` / `ep.api.token.audience_matched` | Counter | `audience_kind` (api_prefixed / implicit_clientid / other / missing) | Api `OnTokenValidated` |

## 6. Trace propagation

OpenTelemetry's W3C Trace Context propagator handles this automatically for
`HttpClient` instrumentation. When BFF's `ProxyController` creates an
outbound `HttpRequestMessage`, OTel injects `traceparent` + `tracestate`
headers. The Api's `AddAspNetCoreInstrumentation` reads them on the way in
and continues the span. End-to-end trace shows up as a single distributed
trace in any OTLP-compatible viewer.

We ALSO carry `X-Correlation-ID` (a separate scalar id) for human-readable
log correlation. Both are useful — `traceparent` is structured for
trace-vis tooling; `X-Correlation-ID` is a flat string ops can grep across
log files.

## 7. Correlation ID middleware (already covered in doc 06)

```csharp
public static IApplicationBuilder UseCorrelationId(this IApplicationBuilder app) =>
    app.Use(async (ctx, next) =>
    {
        var correlationId = ctx.Request.Headers
            .TryGetValue(HttpHeaderNames.CorrelationId, out var header)
                && !string.IsNullOrWhiteSpace(header)
            ? header.ToString()
            : Guid.NewGuid().ToString("D");

        ctx.Response.Headers[HttpHeaderNames.CorrelationId] = correlationId;

        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await next();
        }
    });
```

`BffProxyController.Forward` explicitly forwards `X-Correlation-ID` onto the
outbound request — see doc 05/06 for details.

## 8. Health checks per host

Mirror layout across all three hosts:

| Host | Endpoint | What it checks |
|---|---|---|
| Api | `/health/live` | self (process up) |
| Api | `/health/ready` | EventShopperDb `CanConnectAsync` (3s timeout) |
| Api | `/health/dependencies` | All registered IHealthCheck (db + cache + external services) |
| Web.UI | `/health/live` | self |
| Web.UI | `/health/ready` | downstream Api `/health/live` (3s timeout) |
| Worker | not exposed (no HTTP listener) — `IHostedService` health surfaces in container orchestrator probes |

JSON shape (consistent across hosts):

```json
{
  "status": "Healthy",
  "durationMs": 12.3,
  "entries": {
    "self":            { "status": "Healthy", "description": "...", "durationMs": 0.1, "tags": ["liveness"] },
    "downstream-api":  { "status": "Healthy", "description": "...", "durationMs": 11.7, "tags": ["readiness", "dependency"] }
  }
}
```

Liveness probes (`/health/live`) drive container restart decisions. Readiness
probes (`/health/ready`) drive load-balancer routing decisions.

## 9. Application Insights (SPA only)

The SPA uses the `@microsoft/applicationinsights-web` SDK. Lazy-loaded via
dynamic `import()` inside `TelemetryService.init()` — saves ~150 kB on the
initial bundle for users without an App Insights connection string.

Wire-up (in SPA's `app.config.ts`):

```typescript
provideAppInitializer(() => inject(TelemetryService).init()),
```

`TelemetryService.init()`:

```typescript
async init(): Promise<void> {
  const connectionString = inject(RUNTIME_CONFIG).telemetry.appInsightsConnectionString;
  if (!connectionString) { return; }   // dev / no AI configured

  const { ApplicationInsights } = await import('@microsoft/applicationinsights-web');
  this.appInsights = new ApplicationInsights({
    config: {
      connectionString,
      enableAutoRouteTracking: true,
      enableCorsCorrelation: true,
      correlationHeaderExcludedDomains: ['login.microsoftonline.com'],
    },
  });
  this.appInsights.loadAppInsights();
  this.appInsights.trackPageView();
}
```

## 10. `ObservabilitySettings` (recap)

```csharp
public sealed class ObservabilitySettings
{
    public const string SectionName = "Observability";

    public string ServiceName { get; set; } = "enterprise-platform";
    public string ServiceVersion { get; set; } = "0.0.0-dev";
    public string? OtelEndpoint { get; set; }    // OTLP gRPC endpoint
    public double SamplingRatio { get; set; } = 1.0;
    public bool EnableHttpInstrumentation { get; set; } = true;
    public bool EnableDatabaseInstrumentation { get; set; } = true;
    public string? SeqEndpoint { get; set; }     // Seq sink URL
}
```

`appsettings.{env}.json` per host overrides `ServiceName` / `ServiceVersion`
to identify the host in logs/metrics/traces:

```json
"Observability": {
  "ServiceName": "enterprise-platform-api",       // Api
  "ServiceName": "enterprise-platform-web-ui",    // Web.UI / BFF
  "ServiceName": "enterprise-platform-worker"     // Worker
}
```

## 11. Verifying observability locally

### 11.1 Logs (console)

Just run the host. Every request emits:

```
[14:23:15 INF] HTTP GET /api/v1/whoami responded 200 in 12.4ms ServiceName=enterprise-platform-api CorrelationId=abc-123
```

### 11.2 Logs (Seq)

```bash
docker run -d --name seq -e ACCEPT_EULA=Y -p 5341:80 datalust/seq
```

Set `Observability:SeqEndpoint = "http://localhost:5341"` in
`appsettings.Development.json`. Browse to http://localhost:5341.

### 11.3 Metrics (dotnet-counters)

```bash
dotnet tool install --global dotnet-counters
dotnet-counters monitor --process-id <pid> \
  Enterprise.Platform.Web.UI \
  Enterprise.Platform.Api \
  Microsoft.AspNetCore.Hosting
```

Live counter view in your terminal.

### 11.4 Traces + metrics (OTLP collector → Jaeger / Prometheus)

```bash
# Run an OpenTelemetry collector (or Jaeger all-in-one for traces)
docker run -d --name jaeger \
  -p 4317:4317   # OTLP gRPC
  -p 16686:16686 # UI
  jaegertracing/all-in-one:latest
```

Set `Observability:OtelEndpoint = "http://localhost:4317"`. Browse to
http://localhost:16686.

---

**Next:** [`10-Verification-Checklist.md`](10-Verification-Checklist.md) —
the smoke-test checklist that verifies each phase of the build is healthy.
