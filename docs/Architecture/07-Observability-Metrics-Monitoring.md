# 07 — Observability, Metrics & Monitoring

> Structured logging, OpenTelemetry, health checks, alerting

---

## 1. Structured Logging

### 1.1 Current State ? Enhanced

```csharp
// ? CURRENT: String interpolation logging
logHandler.LogAction(ActionType.Log, 
    $"FetchAllReferral => fetched records count: {response?.Count}");

// ? ENHANCED: Structured logging with semantic properties
logger.LogInformation(
    "Referrals fetched. RecordCount={RecordCount} FilterCount={FilterCount} ElapsedMs={ElapsedMs}",
    response?.Count, filters.Filters.Count, elapsed.TotalMilliseconds);
```

### 1.2 Correlation ID Propagation

```csharp
// All logs across all tiers share a CorrelationId
// Angular ? Web.UI ? App.WebApi ? Database queries

// Middleware adds correlation to all log scopes
app.Use(async (context, next) =>
{
    var correlationId = context.Request.Headers["X-Correlation-ID"].FirstOrDefault() 
        ?? Guid.NewGuid().ToString("N");

    using (logger.BeginScope(new Dictionary<string, object>
    {
        ["CorrelationId"] = correlationId,
        ["UserId"] = context.User?.FindFirst("UserId")?.Value ?? "anonymous",
        ["ClientIP"] = context.Connection.RemoteIpAddress?.ToString() ?? "unknown"
    }))
    {
        context.Response.Headers["X-Correlation-ID"] = correlationId;
        await next(context);
    }
});
```

### 1.3 Log Categories & Levels

| Category | Level | Examples |
|---|---|---|
| Request/Response | Information | Path, status code, elapsed time |
| Business operations | Information | Referral created, case closed |
| PHI access | Warning | SSN viewed, member details accessed |
| Validation failures | Warning | Invalid input rejected |
| Authentication events | Warning | Login, logout, failed attempts |
| Exceptions | Error | Unhandled errors |
| Security events | Critical | Unauthorized PHI access, SQL injection attempts |

---

## 2. OpenTelemetry

```csharp
// Program.cs
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing
        .SetResourceBuilder(ResourceBuilder.CreateDefault()
            .AddService("RIMS-WebApi", serviceVersion: "1.0.0"))
        .AddAspNetCoreInstrumentation(opts =>
        {
            opts.Filter = ctx => !ctx.Request.Path.StartsWithSegments("/health");
            opts.RecordException = true;
        })
        .AddEntityFrameworkCoreInstrumentation(opts =>
        {
            opts.SetDbStatementForText = true;  // Log SQL queries
            opts.SetDbStatementForStoredProcedure = true;
        })
        .AddHttpClientInstrumentation()
        .AddSqlClientInstrumentation(opts => opts.SetDbStatementForText = true)
        .AddSource("RIMS.Application")  // Custom activity sources
        .AddOtlpExporter())  // Or AddConsoleExporter() for dev
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddRuntimeInstrumentation()
        .AddMeter("RIMS.Business")  // Custom meters
        .AddOtlpExporter());
```

### 2.1 Custom Business Metrics

```csharp
public class RimsBusinessMetrics
{
    private static readonly Meter s_meter = new("RIMS.Business");

    // Counters
    public static readonly Counter<long> ReferralsCreated = 
        s_meter.CreateCounter<long>("rims.referrals.created", "count");
    public static readonly Counter<long> CasesClosed = 
        s_meter.CreateCounter<long>("rims.cases.closed", "count");
    public static readonly Counter<long> PHIAccessCount = 
        s_meter.CreateCounter<long>("rims.phi.access", "count");

    // Histograms
    public static readonly Histogram<double> QueryDuration = 
        s_meter.CreateHistogram<double>("rims.query.duration", "ms");
    public static readonly Histogram<double> CommandDuration = 
        s_meter.CreateHistogram<double>("rims.command.duration", "ms");

    // Gauges
    public static readonly ObservableGauge<int> ActiveCases = 
        s_meter.CreateObservableGauge("rims.cases.active", 
            () => GetActiveCaseCount());
}

// Usage in handlers
RimsBusinessMetrics.ReferralsCreated.Add(1, 
    new KeyValuePair<string, object?>("county", countyCode));
```

---

## 3. Health Checks

```csharp
builder.Services.AddHealthChecks()
    .AddSqlServer(
        connectionString, 
        name: "database",
        healthQuery: "SELECT 1",
        failureStatus: HealthStatus.Unhealthy,
        tags: new[] { "db", "critical" })
    .AddCheck<ChipServiceHealthCheck>(
        "chip-service", tags: new[] { "external", "soap" })
    .AddCheck<SsoServiceHealthCheck>(
        "sso-service", tags: new[] { "external", "soap", "critical" })
    .AddCheck<FileStorageHealthCheck>(
        "file-storage", tags: new[] { "storage" })
    .AddCheck<CacheHealthCheck>(
        "cache", tags: new[] { "cache" });

// Map endpoints
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("critical"),
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false  // Just checks if the app is running
});

// Custom health check example
public class ChipServiceHealthCheck : IHealthCheck
{
    private readonly IChipSearchServiceHandler _chipService;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            // Lightweight ping to CHIP service
            var result = await _chipService.Ping();
            return result 
                ? HealthCheckResult.Healthy("CHIP service is responsive")
                : HealthCheckResult.Degraded("CHIP service slow response");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("CHIP service unreachable", ex);
        }
    }
}
```

---

## 4. Alerting Rules

| Metric | Threshold | Action |
|---|---|---|
| Error rate (5xx) | >1% of requests in 5 min | Alert: PagerDuty/Teams |
| Response time P95 | >2 seconds for 5 min | Alert: Teams channel |
| PHI access anomaly | >50 accesses/5 min/user | Alert: Security team |
| Failed login attempts | >10/minute from same IP | Alert: Security + auto-block |
| Database connection pool | >80% utilization | Alert: Infrastructure team |
| Health check failure | Any critical check fails | Alert: On-call engineer |
| Disk space (file storage) | <10% remaining | Alert: Infrastructure team |
| Memory usage | >85% for 10 min | Alert: Infrastructure team |

---

## 5. Dashboard Layout

```
???????????????????????????????????????????????????????????????
?                    RIMS Operations Dashboard                 ?
???????????????????????????????????????????????????????????????
?  Request Rate          ?  Error Rate                        ?
?  ?????????? 142 req/s  ?  ?????????? 0.3%                 ?
???????????????????????????????????????????????????????????????
?  P50 Latency: 45ms    ?  P99 Latency: 890ms               ?
?  Active Cases: 1,247   ?  Pending Referrals: 89            ?
???????????????????????????????????????????????????????????????
?  Health Checks         ?  PHI Access (Last Hour)            ?
?  ? Database           ?  Views: 342                        ?
?  ? SSO Service        ?  Creates: 12                       ?
?  ?? CHIP Service      ?  Updates: 45                       ?
?  ? File Storage       ?  ?? Anomalies: 1                  ?
???????????????????????????????????????????????????????????????
```
