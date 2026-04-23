# 05 — Backend Request Flow (API + Worker)

> **Output of this doc.** A precise mental model of every stage a request
> traverses through the **API host** (Web request) and how the **Worker host**
> drives jobs. Names every middleware, filter, and pipeline behavior in
> execution order.

## 1. API host — request lifecycle (top-down)

```
Browser/curl                                                     elapsed
    │
    ▼
HTTP/1.1 GET /api/v1/whoami
Authorization: Bearer eyJhbGc...
X-Correlation-ID: abc-123
    │
    ▼
[1] Kestrel                                                       0 ms
       accepts the TCP connection, parses the HTTP request
    │
    ▼
[2] CorrelationIdMiddleware                                       <1 ms
       reads X-Correlation-ID (or mints a fresh GUID)
       echoes it on Response.Headers
       pushes to Serilog LogContext (every log line gets the id)
    │
    ▼
[3] GlobalExceptionMiddleware (outermost catch)                   <1 ms
       wraps everything below in try/catch
       on uncaught exception → emits ProblemDetailsExtended JSON
       logs with exception + correlation id
    │
    ▼
[4] SecurityHeadersMiddleware                                     <1 ms
       OnStarting registers callback to set X-Content-Type-Options,
       X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS
    │
    ▼
[5] RequestLoggingMiddleware (optional)                           <1 ms
       emits "Request started" / "Request finished" with duration
       (can be skipped — Serilog request-logging covers this too)
    │
    ▼
[6] UseHttpsRedirection                                           <1 ms
       (skipped in Development for HTTP-loopback dev cycle)
    │
    ▼
[7] UseStaticFiles                                                <1 ms
       short-circuits for /favicon.ico, /robots.txt etc.
    │
    ▼
[8] UseRouting                                                    <1 ms
       matches request to an endpoint
    │
    ▼
[9] UseCors(BffCors)                                              <1 ms
       (no-op when AllowedOrigins is empty post-Phase-9 cutover)
    │
    ▼
[10] UseRateLimiter                                               <1 ms
       global / per-tenant / per-user token buckets;
       429 with Retry-After if exhausted
    │
    ▼
[11] UseAuthentication                                            ~3 ms
       PolicyScheme.ForwardDefaultSelector peeks JWT iss
         → routes to JwtBearer (B2B) or B2C scheme
       JwtBearerHandler validates: signature (JWKS), aud, iss, exp
       on success: HttpContext.User = ClaimsPrincipal
       on B2B success: AudienceMatchMetric counter ticks
       Tenant-mapping: tid claim → ep:tenant_id claim added
    │
    ▼
[12] UseAuthorization                                             <1 ms
       walks endpoint metadata for [Authorize(...)] attributes;
       runs registered IAuthorizationHandlers (RequirePermission, etc.)
    │
    ▼
[13] TenantResolutionMiddleware                                   <1 ms
       reads X-Tenant-ID header OR ep:tenant_id claim
       populates ICurrentTenantService + LogContext
       (pre-condition for tenant-scoped EF queries)
    │
    ▼
[14] Endpoint matched: GET /api/v1/whoami → WhoAmIEndpoint.Handle
       Endpoint Filters fire in registration order:
         (a) ValidationEndpointFilter<TRequest>  — runs FluentValidation
                if request body present;
                returns 400 ProblemDetailsExtended on validation failures
         (b) IdempotencyEndpointFilter            — for POST/PUT with X-Idempotency-Key:
                checks IIdempotencyStore (Redis / in-mem);
                returns cached response if key already processed
         (c) LogEndpointFilter                    — structured log per endpoint
                (Endpoint.Started → Endpoint.Finished with elapsed)
    │
    ▼
[15] Handler delegate executes                                    ~5-50 ms
       For minimal-API endpoints: handler is the lambda inline
       For Dispatcher-routed: dispatcher.Send(query) →
         pipeline behaviors wrap the actual handler:
            ValidationBehavior   → FluentValidation
            CacheBehavior        → IDistributedCache (when [Cacheable] attribute)
            IdempotencyBehavior  → IIdempotencyStore
            TransactionBehavior  → IUnitOfWork.BeginTransactionAsync
            AuditBehavior        → IAuditWriter.WriteAsync (success / failure)
            <Real handler runs at the center>
    │
    ▼
[16] Handler hits Repository / DbContext                          ~2-30 ms
       UoW provides EventShopperDbContext via IDbContextFactory
       EF Core emits SQL → SQL Server
    │
    ▼
[17] Response materialized                                        ~1 ms
       Mapster maps Domain entity → DTO (ApiResponse<T> envelope)
       JSON serialization (System.Text.Json)
    │
    ▼
[18] Response flows back through the middleware stack
       (later registrations exit first)
       SecurityHeadersMiddleware writes its headers (OnStarting fired)
       CorrelationIdMiddleware ensures the response carries X-Correlation-ID
       Kestrel writes bytes
    │
    ▼
HTTP/1.1 200 OK
Content-Type: application/json
X-Correlation-ID: abc-123
{ "data": { ... } }
```

## 2. Middleware registration in `Program.cs` (Api host)

The order here IS the request order. Order matters — get this wrong and you
get bizarre runtime symptoms (CORS preflight blocked, auth headers stripped,
logs missing correlation id, etc.).

```csharp
// src/API/Enterprise.Platform.Api/Program.cs (excerpt)
var app = builder.Build();

app.UseCorrelationId();             // [2]
app.UseGlobalExceptionMiddleware(); // [3]
app.UseSecurityHeaders();           // [4]
// app.UseRequestLogging();         // [5] (optional)

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();      // [6]
}

app.UseStaticFiles();               // [7]
app.UseRouting();                   // [8]
app.UseCors();                      // [9]
app.UseRateLimiter();               // [10]
app.UseAuthentication();            // [11]
app.UseAuthorization();             // [12]
app.UseTenantResolution();          // [13]

app.MapHealthEndpoints();
app.MapWhoAmIEndpoint();
app.MapEventShopperEndpoints();

await app.RunAsync();
```

## 3. Endpoint filters

### 3.1 `ValidationEndpointFilter<TRequest>`

```csharp
public sealed class ValidationEndpointFilter<TRequest>(IValidator<TRequest>? validator)
    : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        if (validator is null) return await next(ctx);

        var request = ctx.Arguments.OfType<TRequest>().FirstOrDefault();
        if (request is null) return await next(ctx);

        var result = await validator.ValidateAsync(request);
        if (!result.IsValid)
        {
            return Results.ValidationProblem(
                result.ToDictionary(),
                title: "Validation failed",
                statusCode: 400);
        }

        return await next(ctx);
    }
}
```

Wire per-endpoint:
```csharp
app.MapPost("/api/v1/orders", async (CreateOrderRequest req, IDispatcher d) => { ... })
   .AddEndpointFilter<ValidationEndpointFilter<CreateOrderRequest>>();
```

### 3.2 `IdempotencyEndpointFilter`

For POST / PUT with `X-Idempotency-Key` header → checks `IIdempotencyStore`
(Redis / in-mem) for prior result. If found, returns cached. If not, runs
the handler and caches the response keyed by `X-Idempotency-Key`. TTL ~24h.

### 3.3 `LogEndpointFilter`

Wraps handler with structured `Endpoint.Started` / `Endpoint.Finished`
log lines including elapsed time + status code.

## 4. Pipeline behaviors (CQRS — `Application` project)

Whenever a handler is invoked through the Dispatcher, behaviors wrap it
in onion order:

```
dispatcher.Send(query)
    ↓
ValidationBehavior         (runs FluentValidation against TRequest)
    ↓
CacheBehavior              (when [Cacheable] attribute on request type)
    ↓
IdempotencyBehavior        (when [Idempotent] attribute)
    ↓
TransactionBehavior        (begins UoW transaction)
    ↓
AuditBehavior              (captures pre/post state)
    ↓
<actual handler>
    ↓
AuditBehavior              (writes audit row with success/failure)
    ↓
TransactionBehavior        (commit / rollback)
    ↓
IdempotencyBehavior        (cache the result by idempotency key)
    ↓
CacheBehavior              (cache the result by query key)
    ↓
ValidationBehavior         (no-op on the way out)
    ↓
result returned
```

### 4.1 `IPipelineBehavior` contract

```csharp
public interface IPipelineBehavior<TRequest, TResponse>
{
    Task<TResponse> Handle(
        TRequest request,
        Func<Task<TResponse>> next,
        CancellationToken cancellationToken);
}
```

### 4.2 Dispatcher composition (rough sketch)

```csharp
public sealed class Dispatcher(IServiceProvider serviceProvider) : IDispatcher
{
    public async Task<TResult> Send<TResult>(IQuery<TResult> query, CancellationToken ct)
    {
        var handlerType = typeof(IQueryHandler<,>).MakeGenericType(query.GetType(), typeof(TResult));
        var handler = serviceProvider.GetRequiredService(handlerType);

        var behaviors = serviceProvider
            .GetServices(typeof(IPipelineBehavior<,>).MakeGenericType(query.GetType(), typeof(TResult)))
            .Cast<dynamic>()
            .Reverse()  // outermost behavior runs first → wraps innermost
            .ToList();

        Func<Task<TResult>> pipeline = () => (Task<TResult>)handler
            .GetType()
            .GetMethod("Handle")!
            .Invoke(handler, new object[] { query, ct })!;

        foreach (var behavior in behaviors)
        {
            var current = pipeline;
            pipeline = () => behavior.Handle((dynamic)query, current, ct);
        }

        return await pipeline();
    }
}
```

## 5. Worker host — job lifecycle

The Worker is a `Microsoft.NET.Sdk.Worker` host. It runs one or more
`IHostedService` implementations + (planned) Hangfire-scheduled jobs.

### 5.1 `Program.cs` (Worker)

```csharp
var builder = Host.CreateApplicationBuilder(args);

// Same Serilog + configuration layering as Api / Web.UI
builder.Configuration
    .AddJsonFile("appsettings.json", optional: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true)
    .AddEnvironmentVariables();

builder.Services.AddSerilog();
builder.Services.AddPlatformInfrastructure(builder.Configuration);
builder.Services.AddPlatformOpenTelemetry(builder.Configuration);

// Job registration
builder.Services.AddHostedService<OutboxProcessorJob>();
builder.Services.AddHostedService<CacheWarmupJob>();
// builder.Services.AddHostedService<AuditRetentionJob>();  (D4-deferred)

await builder.Build().RunAsync();
```

### 5.2 `OutboxProcessorJob` (drains transactional outbox to broker)

```csharp
public sealed partial class OutboxProcessorJob(
    IServiceScopeFactory scopeFactory,
    ILogger<OutboxProcessorJob> logger,
    IOptions<JobsSettings> options) : BackgroundService
{
    [LoggerMessage(EventId = 6001, Level = LogLevel.Information,
        Message = "Outbox.Drain.Tick — processed {Count} messages in {ElapsedMs}ms.")]
    private partial void LogTick(int count, long elapsedMs);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var pollInterval = TimeSpan.FromSeconds(options.Value.OutboxProcessor.PollIntervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = scopeFactory.CreateScope();
            var publisher = scope.ServiceProvider.GetRequiredService<IOutboxPublisher>();

            var sw = Stopwatch.StartNew();
            var count = await publisher.DrainBatchAsync(options.Value.OutboxProcessor.BatchSize, stoppingToken);
            LogTick(count, sw.ElapsedMilliseconds);

            await Task.Delay(pollInterval, stoppingToken);
        }
    }
}
```

### 5.3 `CacheWarmupJob`

Refreshes static lookup data caches periodically + on startup.

### 5.4 `AuditRetentionJob` (D4-deferred)

DELETEs `AuditLogs` rows older than `RetentionDays`. Currently a placeholder.

## 6. End-to-end trace example

User clicks "Test now" in the SPA → BFF proxies → Api responds. Full trace:

```
[Browser]   GET /api/proxy/v1/whoami
            Cookie: ep.bff.session=...
            X-Correlation-ID: abc-123
                    │
                    ▼
[BFF :5001] (covered in doc 06)
            ProxyController.Forward extracts "v1/whoami" as downstream path,
            stitches with Proxy.ApiBaseUri (http://localhost:5044/api/),
            attaches Bearer from cookie ticket, forwards to Api
                    │
                    ▼
[Api :5044] GET http://localhost:5044/api/v1/whoami
            Authorization: Bearer <stashed access token>
            X-Correlation-ID: abc-123 (forwarded by BFF)
                    │
                    ▼
            ── Middleware pipeline (steps 2-13 above) ──
                    │
                    ▼
            WhoAmIEndpoint.Handle:
              return Results.Ok(new {
                isAuthenticated = ctx.User.Identity?.IsAuthenticated == true,
                name = ctx.User.Identity?.Name,
                claimCount = ctx.User.Claims.Count(),
                claims = ctx.User.Claims.GroupBy(c => c.Type, ...)
                                        .ToDictionary(g => g.Key, g => string.Join(",", g.Select(c => c.Value))),
              });
                    │
                    ▼
            200 OK
            X-Correlation-ID: abc-123
            { "isAuthenticated": true, "name": "...", "claimCount": 27, "claims": {...} }
                    │
                    ▼
[BFF]       streams response back to browser
                    │
                    ▼
[Browser]   SPA renders green banner "27 claims"
```

The same `X-Correlation-ID` traverses Browser → BFF → Api → BFF → Browser
and ties together log lines across all three surfaces.

---

**Next:** [`06-BFF-And-Frontend-Flow.md`](06-BFF-And-Frontend-Flow.md) —
how the BFF middleware stack and the Angular interceptor chain work in detail.
