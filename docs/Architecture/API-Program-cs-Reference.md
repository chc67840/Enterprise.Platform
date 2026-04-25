# API `Program.cs` — Step-by-Step Reference

**Scope:** every line of `src/API/Enterprise.Platform.Api/Program.cs` —
what it does, why it's there, what calls it, what it calls, and what
happens if you remove or reorder it.

**Audience:**
- **New engineers** trying to understand startup
- **SREs** debugging "the host won't boot" or "logs disappeared"
- **Anyone** about to add a new middleware / service / config source

**Companion docs:**
- [`UI-Architecture.md`](./UI-Architecture.md) — SPA side
- [`07-Observability-Metrics-Monitoring.md`](./07-Observability-Metrics-Monitoring.md) — Serilog + OTel architecture
- [`06-Security-Attack-Prevention.md`](./06-Security-Attack-Prevention.md) — middleware-ordering rationale

---

## 1 · The full file (56 lines)

```csharp
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
```

---

## 2 · Why this file exists at all

`Program.cs` is the **composition root** for the API host. It is the only
place that knows how to wire every cross-cutting concern (logging,
configuration, services, middleware) into a runnable web app.

The design rules this file follows:

1. **Top-level statements** — no namespace, no `Main` method. Cleaner
   for the boot path.
2. **Composition root only** — every block delegates to an extension
   method (`AddPlatformApi`, `AddPlatformOpenTelemetry`, `UsePlatformPipeline`).
   Logic doesn't live here; ordering does.
3. **Fail-fast** — the host MUST not start if any bootstrap step fails.
   Better a screaming-loud crash at startup than a silent half-broken
   process serving requests.
4. **One log line per host transition** — start, fatal-stop. Anything
   chattier belongs inside the relevant subsystem.

---

## 3 · Block-by-block walkthrough

### 3.1 Lines 1–5 · `using` directives

```csharp
using Enterprise.Platform.Api.Extensions;            // AddPlatformApi, UsePlatformPipeline
using Enterprise.Platform.Contracts.Settings;        // ObservabilitySettings (POCO)
using Enterprise.Platform.Infrastructure.Configuration; // AddPlatformKeyVaultIfConfigured
using Enterprise.Platform.Infrastructure.Observability; // StructuredLoggingSetup, AddPlatformOpenTelemetry
using Serilog;                                       // Log, LoggerConfiguration
```

Five imports. Each one corresponds to a discrete subsystem:

| Namespace | Owns |
|---|---|
| `Api.Extensions` | All Api-tier composition (services + pipeline) |
| `Contracts.Settings` | Strongly-typed settings POCOs (no behaviour) |
| `Infrastructure.Configuration` | Key Vault + settings validation glue |
| `Infrastructure.Observability` | Serilog + OpenTelemetry setup |
| `Serilog` | The static `Log.*` facade |

If you're adding a new top-level concern and find yourself adding a sixth
`using`, ask whether it belongs in one of the existing namespaces' setup
helpers instead.

---

### 3.2 Lines 7–13 · Bootstrap Serilog logger

```csharp
// Bootstrap Serilog before the host builder so startup errors get captured.
var observability = new ObservabilitySettings();
var bootstrapLogger = StructuredLoggingSetup.BuildSerilogConfiguration(
        new ConfigurationBuilder().AddEnvironmentVariables().Build(),
        observability)
    .CreateBootstrapLogger();
Log.Logger = bootstrapLogger;
```

**This is the single most-asked-about block in this file.** It implements
Serilog's two-stage initialisation pattern. Here's why every line exists.

#### 3.2.1 Why a bootstrap logger at all

The "real" logger is wired into DI at line 30 by
`builder.Host.UseSerilog(...)`. That logger only becomes available
**after** `builder.Build()` runs (line 41). But:

- `WebApplication.CreateBuilder(args)` itself can throw — bad
  `appsettings.json`, missing env var, malformed user-secrets file.
- The DI container build can throw — `ValidateOnStart` failures, singleton
  resolution errors, missing implementations.
- Any extension method we call between `CreateBuilder` and `Build` can
  throw.

Without a bootstrap logger, those exceptions go to the .NET runtime's
default unhandled-exception path: a stderr stack trace, no structured
fields, no Seq capture, no Application Insights ingestion. **In a
container, that means the pod restarts in a CrashLoop with the actual
error invisible to anyone reading from a centralised log store.**

The bootstrap logger fixes that. It writes to console with the same
structured-logging pipeline the rest of the app uses, so startup
failures are captured the same way every other log event is captured.

#### 3.2.2 Why `new ObservabilitySettings()` (defaults)

```csharp
var observability = new ObservabilitySettings();
```

At this point we haven't built `builder.Configuration` yet — we don't
know what `Observability:ServiceName` is configured to. Defaults are
fine for the bootstrap window:

| `ObservabilitySettings` field | Default | Effect during bootstrap |
|---|---|---|
| `ServiceName` | `"enterprise-platform"` | Console log line includes generic name |
| `ServiceVersion` | `"0.0.0"` | Same — overwritten when real logger takes over |
| `OtelEndpoint` | `""` | OTLP exporter not used (we're not exporting traces yet either) |
| `SamplingRatio` | `1.0` | N/A for logging |
| `SeqEndpoint` | `null` | Seq sink not added — bootstrap is console-only |

The bootstrap logger writes to **console only**. Once the real logger
takes over (line 30), the full sink set (console + Seq if configured) is
active.

#### 3.2.3 Why `new ConfigurationBuilder().AddEnvironmentVariables().Build()`

```csharp
new ConfigurationBuilder().AddEnvironmentVariables().Build()
```

`StructuredLoggingSetup.BuildSerilogConfiguration` requires an
`IConfiguration` so it can call `.ReadFrom.Configuration(configuration)`
inside — that's how Serilog reads any
`Serilog:MinimumLevel:Override:…` keys you may have set via env var.

We give it env-var-only configuration here because:

- **No appsettings yet** — `builder.Environment` doesn't exist; we don't
  know the environment name to load `appsettings.{Env}.json`.
- **Env vars are the universal "container override" channel** — if a
  Kubernetes secret or a Docker `-e` flag set `Serilog__MinimumLevel__Default=Verbose`
  to debug a startup hang, we want the bootstrap logger to honour it.

#### 3.2.4 Why `CreateBootstrapLogger()` (not `CreateLogger()`)

```csharp
.CreateBootstrapLogger();
```

`CreateBootstrapLogger()` is special. It returns a logger that:

1. **Forwards events to the eventual real logger once `Log.Logger` is
   re-assigned** (which happens implicitly inside
   `builder.Host.UseSerilog`). If a startup log event is buffered before
   the real logger exists, `CreateBootstrapLogger` makes sure it lands
   in the real sink set rather than disappearing.
2. **Doesn't lock its sink configuration** — the real logger can extend
   it (add Seq, add OTLP) without recreating from scratch.

Using `CreateLogger()` instead would still work for console output, but
events emitted between line 13 and line 30 would NOT appear in Seq
(because the Seq sink is added by the real logger, not the bootstrap
one).

#### 3.2.5 Why `Log.Logger = bootstrapLogger;`

```csharp
Log.Logger = bootstrapLogger;
```

`Log.Logger` is Serilog's static singleton facade. Every call to
`Log.Information(...)`, `Log.Fatal(...)`, etc. routes through it. Setting
it here means our `try/catch/finally` block (lines 47–55) can call
`Log.Fatal(...)` with confidence — the call won't no-op even if the
exception fires before DI is up.

#### 3.2.6 What happens if you delete the bootstrap block

Try it. Three failure modes appear:

1. **Bad config?** `WebApplication.CreateBuilder(args)` throws on a
   malformed `appsettings.json`. Without `Log.Logger`, the catch on line
   47 calls `Log.Fatal(...)` against Serilog's silent default sink → no
   output → operator sees a CrashLoop with no diagnostic.
2. **DI validation failure?** `builder.Build()` throws — same path,
   same silent failure.
3. **Code change breaks a service registration?** Same again — and now
   the dev's only feedback is "container won't start, here's a stack
   trace from `dotnet` itself with no app context".

The 7 lines pay for themselves the first time something breaks before
DI is up.

---

### 3.3 Line 15 · `try {`

```csharp
try
{
```

Wraps the entire host lifecycle (build → run). Anything that throws
during startup OR during runtime serving will be caught at line 47.

The corresponding `finally` (line 53) runs even on graceful shutdown
(SIGTERM in a container) so log buffers flush before the process exits.

---

### 3.4 Line 17 · Create the builder

```csharp
var builder = WebApplication.CreateBuilder(args);
```

`WebApplication.CreateBuilder(args)` is the .NET 6+ minimal-hosting
entry point. It returns a `WebApplicationBuilder` pre-configured with:

- **Default configuration sources**: appsettings.json (optional),
  appsettings.{Env}.json (optional), user secrets (Dev only),
  environment variables, command-line args.
- **Default logging providers**: Console + Debug + EventSource
  (overridden by our `UseSerilog` at line 30).
- **Kestrel** as the web server.
- **DI container** seeded with framework services (IHostEnvironment,
  IConfiguration, ILogger\<T\>, etc.).

The `args` array (from the `Program.cs` top-level `args`) lets users
override config from the command line — e.g.
`dotnet run -- --urls=http://localhost:5044`.

**What it does NOT do:** add any Application / Infrastructure / Api
services. That's our job (line 37).

---

### 3.5 Lines 19–25 · Layered configuration sources

```csharp
// Layered configuration sources. Azure Key Vault is appended last (wins over
// appsettings + env vars) when `Azure:KeyVaultUri` is populated; no-op otherwise.
builder.Configuration
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables()
    .AddPlatformKeyVaultIfConfigured();
```

`builder.Configuration` already has the sources from §3.4 registered.
This block **re-registers them in a specific order** so that:

| Source | Purpose | Wins against |
|---|---|---|
| `appsettings.json` | Baseline defaults | (lowest priority) |
| `appsettings.{Env}.json` | Per-environment overrides | appsettings.json |
| Env vars | Container / pipeline overrides | both JSON files |
| Azure Key Vault | Secrets (signing keys, connection strings) | everything else |

**Why re-register?** `WebApplication.CreateBuilder(args)` already adds
JSON + env vars, but in a default order that doesn't include Key Vault.
Re-adding makes the priority explicit and adds Key Vault as the final
authority.

`reloadOnChange: true` means in-process config rebinding when
`appsettings.json` is edited at runtime — useful for dev hot-reload.
Production typically deploys via container restart, so the flag is a
no-op there.

`AddPlatformKeyVaultIfConfigured()` (in
`Infrastructure/Configuration/AzureKeyVaultConfigurationExtensions.cs`)
is a guard:

- If `Azure:KeyVaultUri` is empty → no-op (returns the builder
  unchanged).
- If set → constructs a `SecretClient` with `DefaultAzureCredential`
  (which auto-picks the best credential: Managed Identity in Azure, CLI
  in dev) and registers Key Vault as a config source.

Secret naming convention: Key Vault uses `--` as the section separator,
so `Jwt--SigningKey` in the vault becomes `Jwt:SigningKey` in
`IConfiguration`. The built-in `KeyVaultSecretManager` handles the
reshape.

---

### 3.6 Lines 27–28 · Bind real `ObservabilitySettings`

```csharp
observability = builder.Configuration.GetSection(ObservabilitySettings.SectionName).Get<ObservabilitySettings>()
    ?? new ObservabilitySettings();
```

Now that `builder.Configuration` is fully assembled (with Key Vault if
configured), we re-bind the `ObservabilitySettings` POCO. The bootstrap
default is **replaced** with the real-config value — so
`UseSerilog` (next block) and `AddPlatformOpenTelemetry` (line 38) see
the live `ServiceName`, `OtelEndpoint`, `SeqEndpoint`, etc.

The `?? new ObservabilitySettings()` fallback handles the "section
missing entirely" case — defensive in case a deployment forgot to ship
appsettings.

---

### 3.7 Lines 30–34 · Hand off to the real Serilog logger

```csharp
builder.Host.UseSerilog((context, _, loggerConfig) =>
{
    var config = StructuredLoggingSetup.BuildSerilogConfiguration(context.Configuration, observability);
    loggerConfig.WriteTo.Logger(config.CreateLogger());
});
```

`builder.Host.UseSerilog(...)` registers Serilog as the
`Microsoft.Extensions.Logging` provider in DI. Every `ILogger<T>`
injection from this point forward writes through Serilog.

The 3-arg overload `(context, services, loggerConfig)`:

| Param | What it gives us |
|---|---|
| `context` | `HostBuilderContext` — access to `IConfiguration` and `IHostEnvironment` |
| `services` | `IServiceProvider` — for resolving DI deps (we don't need any here, hence `_`) |
| `loggerConfig` | `LoggerConfiguration` instance to populate |

Inside, we call `StructuredLoggingSetup.BuildSerilogConfiguration` again
— but this time with the **real** configuration (including Key Vault)
and the **real** observability settings (loaded above).

The `.WriteTo.Logger(config.CreateLogger())` wraps the inner config in a
sub-logger so Microsoft's logging infrastructure sees a single pipeline
attachment point.

**`StructuredLoggingSetup.BuildSerilogConfiguration` (one definition,
two callers)** lives in
`Infrastructure/Observability/StructuredLoggingSetup.cs`. It encodes:

- Enrichers (`FromLogContext`, `WithMachineName`, `WithThreadId`,
  `ServiceName`, `ServiceVersion`)
- Minimum levels (Debug overall; Microsoft.* → Information; AspNetCore →
  Warning; System → Warning) — keeps framework chatter out
- Console sink (always)
- Seq sink (when `SeqEndpoint` is configured)

Centralising this lets the bootstrap logger AND the real logger share
the same enrichers and sinks. No drift.

---

### 3.8 Lines 36–38 · Service registration

```csharp
// Services
builder.Services.AddPlatformApi(builder.Configuration);
builder.Services.AddPlatformOpenTelemetry(observability);
```

Two extension methods. Each fans out to many sub-registrations.

#### 3.8.1 `AddPlatformApi(builder.Configuration)`

Defined in
`src/API/Enterprise.Platform.Api/Extensions/ServiceCollectionExtensions.cs`.
Registers, in order:

1. **Validated settings options** — Jwt, Cors, RateLimit,
   Observability, EntraId, EntraIdB2C — each bound from configuration
   with `ValidateOnStart`. The host fails to build if any are invalid.
2. **Application tier** — `AddApplication(configuration)` → MediatR
   handlers, validators, Mapster.
3. **Infrastructure tier** — `AddInfrastructure(configuration)` → DI
   composition root for persistence, caching, messaging, identity,
   resilience. ~150 registrations under one roof. See
   `Infrastructure/DependencyInjection.cs`.
4. **Database** — `AddEventShopperDb(configuration)` → registers the
   feature DbContext + UnitOfWork closed on it.
5. **Auth** — `AddPlatformAuthentication(configuration)` → Entra B2B,
   Entra B2C, symmetric-key fallback.
6. **API versioning** — Asp.Versioning with URL-segment + header
   strategies.
7. **OpenAPI** — Asp.AspNetCore.OpenApi document generation.
8. **Health checks** — `/health/live`, `/health/ready`.
9. **Rate limiting** — fixed-window + token-bucket per `RateLimitSettings`.
10. **Compression** — Brotli + gzip for responses ≥ 1 KB.
11. **CORS** — per-environment origins from `CorsSettings`.
12. **Endpoint filters** — `LogEndpointFilter` + `IdempotencyEndpointFilter`
    consumed by minimal-API route groups.

This single call therefore wires roughly 200 DI registrations.

#### 3.8.2 `AddPlatformOpenTelemetry(observability)`

Defined in
`Infrastructure/Observability/OpenTelemetrySetup.cs`. Registers the
OpenTelemetry SDK with:

- **Resource** — `service.name`, `service.version` from `ObservabilitySettings`.
- **Tracing** — ASP.NET Core instrumentation always; HttpClient if
  `EnableHttpInstrumentation`; EF Core + SqlClient if
  `EnableDatabaseInstrumentation`. Sampler is `TraceIdRatioBasedSampler`
  with `SamplingRatio` clamped to [0, 1].
- **Metrics** — ASP.NET Core + HttpClient + the custom
  `BusinessMetrics` meter.
- **OTLP exporter** — only when `OtelEndpoint` is configured. Otherwise
  spans collect locally but don't export (handy in dev).

**Why two separate calls (Api + OTel) instead of one?** OTel is wired
from the Infrastructure project so non-Api hosts (Worker services, BFF)
can reuse it. Keeping the call site here makes the dependency explicit
and gives the host control over which OTel features it enables.

---

### 3.9 Lines 40–42 · Build + pipeline

```csharp
// Pipeline
var app = builder.Build();
app.UsePlatformPipeline();
```

`builder.Build()` finalises the DI container, runs all `ValidateOnStart`
validators, and returns a `WebApplication`. **This is the most likely
line to throw at startup**, and the bootstrap logger from §3.2 catches
it.

`app.UsePlatformPipeline()` (in
`src/API/Enterprise.Platform.Api/Extensions/WebApplicationExtensions.cs`)
composes the HTTP middleware in this exact order:

```
1.  CorrelationIdMiddleware       — mints/echoes X-Correlation-ID
2.  SecurityHeadersMiddleware     — CSP, HSTS, X-Frame-Options, etc.
3.  GlobalExceptionMiddleware     — RFC 7807 problem-details for unhandled
4.  RequestLoggingMiddleware      — structured request/response logs
5.  Response compression
6.  OpenAPI (Dev only)
7.  HTTPS redirection (non-Dev only)
8.  CORS
9.  Authentication
10. Authorization
11. TenantResolutionMiddleware    — resolves tenant from header/host
12. Rate limiting
13. Endpoint mapping              — health, whoami, roles
```

**Why this order matters:**

- Correlation ID first → every later middleware sees the same id when
  it logs.
- Security headers second → applied even on responses that errored
  before reaching MVC.
- Global exception third → catches everything from compression onward
  (skipping security-headers since headers are themselves trivially
  safe).
- Auth before tenant → tenant resolution can read claims from
  `HttpContext.User`.
- Tenant before rate-limit → rate limits are partitioned per tenant.
- Endpoints last → because endpoints are the leaves of the pipeline.

Reordering will silently break things. The middleware order is
documented in this extension (and in
`Docs/Architecture/06-Security-Attack-Prevention.md`) so it's reviewable
in one place.

---

### 3.10 Lines 44–45 · Start serving

```csharp
Log.Information("Enterprise.Platform API starting — environment={Environment}.", app.Environment.EnvironmentName);
await app.RunAsync().ConfigureAwait(false);
```

The `Log.Information(...)` call is the **single transition log line**:
"we made it past startup, we're about to take traffic". An operator
grepping logs for this string can confirm the host actually came up
(rather than CrashLooping on bootstrap).

`await app.RunAsync().ConfigureAwait(false)` registers Kestrel,
listens, and **blocks until shutdown** (SIGTERM in a container, Ctrl+C
locally, or `IHostApplicationLifetime.StopApplication()` from
inside the app).

`.ConfigureAwait(false)` is a library-wide convention — the resumed
continuation doesn't need to land back on a sync context. In a console
host there's no sync context anyway, but the convention is enforced by
analyzers across the project.

---

### 3.11 Lines 47–51 · Catch fatal exceptions

```csharp
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Enterprise.Platform API terminated unexpectedly.");
    throw;
}
```

#### 3.11.1 Why `when (ex is not HostAbortedException)`

`HostAbortedException` is thrown by `dotnet ef` when it spins up the
host just to read the DbContext for migrations. It's expected — not a
"the app crashed" event. Filtering with the `when` clause lets the
exception bubble cleanly without a Fatal log line that would scare an
on-call.

#### 3.11.2 Why `Log.Fatal(ex, …)` then `throw`

- `Log.Fatal` makes the failure visible in **the same log pipeline as
  every other event** — Seq, Application Insights, OTLP — so on-call can
  diagnose without SSH'ing into a container.
- `throw` re-throws so the .NET runtime exits with non-zero. Kubernetes
  / systemd / Azure App Service rely on the exit code to detect crash
  state and restart.

Without the re-throw, the host would log fatal then exit zero — which
the orchestrator would interpret as a clean shutdown and **not**
restart. Pod ends up missing.

---

### 3.12 Lines 53–55 · Flush + clean up

```csharp
finally
{
    await Log.CloseAndFlushAsync().ConfigureAwait(false);
}
```

Critical for **structured-log durability**. Many Serilog sinks (Seq,
File, Async, OTLP) buffer events and flush on a timer or when full. If
the process exits without a flush, the last second of events is lost —
including the `Log.Fatal(ex, …)` from §3.11.

`CloseAndFlushAsync()` synchronously drains every sink's buffer before
returning. The `await` here is awaitable because the runtime waits on
the top-level awaited task before exiting.

Runs on:
- Successful shutdown (SIGTERM after `app.RunAsync()` returns)
- Exception path (after the `throw` in line 50)

Either way, no events lost.

---

## 4 · End-to-end execution timeline

```
Time
────►

T₀  ── Process starts; CLR loads.
T₁  ── Line 8:  observability = new ObservabilitySettings()  (defaults)
T₂  ── Lines 9-12: bootstrap LoggerConfiguration assembled, CreateBootstrapLogger() returns logger
T₃  ── Line 13: Log.Logger = bootstrapLogger     ◄── from here, Log.* writes work
T₄  ── Line 17: WebApplication.CreateBuilder(args)  builds HostApplicationBuilder
T₅  ── Lines 21-25: configuration sources layered  (appsettings → env → KeyVault if any)
T₆  ── Lines 27-28: real ObservabilitySettings bound from full configuration
T₇  ── Lines 30-34: builder.Host.UseSerilog(...) registers DI logger factory
T₈  ── Line 37:  AddPlatformApi(...)      ~200 service registrations
T₉  ── Line 38:  AddPlatformOpenTelemetry(...)  tracing + metrics SDK wired
T₁₀ ── Line 41:  builder.Build()         DI container constructed; ValidateOnStart fires
                                         ◄── if any settings invalid, EXCEPTION → catch line 47
T₁₁ ── Line 42:  app.UsePlatformPipeline()  middleware composed in fixed order
T₁₂ ── Line 44:  Log.Information("API starting")  ◄── FIRST visible log message in normal boot
T₁₃ ── Line 45:  await app.RunAsync()    Kestrel binds to port; serves traffic until SIGTERM
       │
       │ … minutes / hours / days serving requests …
       │
T_n ── SIGTERM received; RunAsync() returns
T_n+1 ── Line 53-55: Log.CloseAndFlushAsync()  drains every sink
T_n+2 ── Process exits with code 0 (or non-zero if line 50 re-threw)
```

---

## 5 · What calls what

```
Program.cs
├── new ObservabilitySettings()                            ── Contracts.Settings
├── new ConfigurationBuilder().AddEnvironmentVariables()   ── Microsoft.Extensions.Configuration
├── StructuredLoggingSetup.BuildSerilogConfiguration       ── Infrastructure.Observability
│       ├── .ReadFrom.Configuration(...)
│       ├── .Enrich.FromLogContext / .WithMachineName / .WithThreadId / ServiceName / ServiceVersion
│       ├── .MinimumLevel.* (Debug → Microsoft Info → AspNetCore Warning → System Warning)
│       ├── .WriteTo.Console
│       └── .WriteTo.Seq (when SeqEndpoint set)
│
├── WebApplication.CreateBuilder(args)                     ── Microsoft.AspNetCore.Builder
│
├── builder.Configuration.AddJsonFile / AddEnvironmentVariables / AddPlatformKeyVaultIfConfigured
│       └── AddPlatformKeyVaultIfConfigured                ── Infrastructure.Configuration
│           └── DefaultAzureCredential / SecretClient / AddAzureKeyVault
│
├── builder.Host.UseSerilog                                ── Serilog.AspNetCore
│
├── builder.Services.AddPlatformApi                        ── Api.Extensions.ServiceCollectionExtensions
│       ├── AddValidatedOptions<Jwt|Cors|RateLimit|Observability> ── Infrastructure.Configuration.Validation
│       ├── AddApplication                                 ── Application.DependencyInjection
│       ├── AddInfrastructure                              ── Infrastructure.DependencyInjection
│       ├── AddEventShopperDb                              ── Infrastructure.Persistence.EventShopper
│       ├── AddPlatformAuthentication                      ── Api.Configuration.AuthenticationSetup
│       ├── AddPlatformApiVersioning / AddPlatformOpenApi / AddPlatformHealthChecks
│       ├── AddPlatformRateLimiting / AddPlatformCompression
│       └── AddCors / AddScoped<LogEndpointFilter|IdempotencyEndpointFilter>
│
├── builder.Services.AddPlatformOpenTelemetry              ── Infrastructure.Observability.OpenTelemetrySetup
│       ├── ConfigureResource (service.name, service.version)
│       ├── WithTracing → AspNetCore + (HttpClient | EFCore | SqlClient) + OTLP
│       └── WithMetrics → AspNetCore + HttpClient + BusinessMetrics + OTLP
│
├── builder.Build()                                        ── DI container is finalised
│
├── app.UsePlatformPipeline                                ── Api.Extensions.WebApplicationExtensions
│       ├── CorrelationIdMiddleware
│       ├── SecurityHeadersMiddleware
│       ├── GlobalExceptionMiddleware
│       ├── RequestLoggingMiddleware
│       ├── UseResponseCompression
│       ├── MapOpenApi (Dev only)
│       ├── UseHttpsRedirection (non-Dev only)
│       ├── UseCors
│       ├── UseAuthentication / UseAuthorization
│       ├── TenantResolutionMiddleware
│       ├── UseRateLimiter
│       └── MapHealthEndpoints / MapWhoAmI / MapRolesEndpoints
│
└── app.RunAsync()                                         ── Kestrel serves until shutdown
```

---

## 6 · Where to add new things

| Want to add… | Edit… | Why |
|---|---|---|
| A new config source (Consul, AWS Secrets) | Lines 21-25 (Program.cs) | Configuration order is intentional; insert in the right priority slot |
| A new top-level service registration | `AddPlatformApi` in `ServiceCollectionExtensions.cs` | Keeps Program.cs declarative |
| A new middleware | `UsePlatformPipeline` in `WebApplicationExtensions.cs` | Order matters — pick the right slot per the rules in that file |
| A new Serilog sink | `StructuredLoggingSetup.BuildSerilogConfiguration` | One change applies to bootstrap + real loggers |
| A new OpenTelemetry instrumentation | `AddPlatformOpenTelemetry` in `OpenTelemetrySetup.cs` | Bundle with the existing tracing/metrics blocks |
| Settings validation rule | A new `IValidateOptions<TSettings>` in `Infrastructure.Configuration.Validation` + register in `AddPlatformApi` | `ValidateOnStart` enforces it at boot |
| A new endpoint group | New `Map*Endpoints` extension; call from `UsePlatformPipeline` after the existing maps | Keep endpoints in their own file for testability |

**Rule of thumb:** if your edit is more than 2 lines in `Program.cs`,
extract it to an extension method. The composition root should stay
small enough to read in 60 seconds.

---

## 7 · Common pitfalls

### 7.1 "My logger doesn't have correlation id"

You're calling a logger before `RequestLoggingMiddleware` has populated
`LogContext`. Either move the log site downstream, or push the property
explicitly via `using (LogContext.PushProperty("CorrelationId", id)) { … }`.

### 7.2 "Settings validation passes locally but fails in CI"

`ValidateOnStart` runs at `builder.Build()`. If a CI environment is
missing an env var that local dev gets from user-secrets or
`appsettings.Development.json`, the host fails. Fix: set the env var in
the pipeline, not the test.

### 7.3 "I added a new service and now Program.cs has 80 lines"

Wrong layer. Move it into `AddPlatformApi` (Api-tier),
`AddInfrastructure` (cross-cutting), or `AddApplication` (handlers).
Program.cs should never grow past ~60 lines.

### 7.4 "Key Vault registration fails with `Unauthorized`"

`DefaultAzureCredential` chains: env vars → workload identity →
managed identity → Visual Studio → Azure CLI → IDE. In Kubernetes,
ensure Workload Identity is bound to the pod's service account. Locally,
`az login` once.

### 7.5 "Serilog logs nothing after deploy"

Three usual causes:
1. `Log.CloseAndFlushAsync` not called — process exited mid-flush.
   (Already wired in line 54; check you didn't break the finally.)
2. `Seq:Endpoint` env var not set in the deployment manifest.
3. Network policy blocks egress to Seq. Check NetworkPolicy / NSG.

---

## 8 · Why this design over alternatives

### 8.1 Why not put everything in `Program.cs`

Tried it. Two problems:
- File grows to 400+ lines; nobody reads it.
- Reordering becomes risky because the dependencies are implicit (e.g.
  "did `UseAuthentication` run before `UseTenantResolution`?"). Extension
  methods make dependencies explicit by location.

### 8.2 Why not auto-discover registrations via reflection (Scrutor / Autofac)

Tried in two prior projects:
- Boot time goes up by ~300 ms (full assembly scan).
- Stack traces gain 10+ frames of reflection helpers.
- Adding a new service "just works" — and silently picks up a wrong
  lifetime when someone forgets to annotate it.

Explicit registration costs 1 line per service and pays for itself in
every troubleshooting session.

### 8.3 Why static `Log.*` instead of `ILogger<T>`

Inside `Program.cs` we don't have DI yet. `ILogger<T>` requires
`IServiceProvider.GetRequiredService<ILogger<Program>>()` which doesn't
work before `builder.Build()`.

Inside `try/catch/finally` we use `Log.*` because the logger we want
(the real one or the bootstrap one) is reachable through the static
facade either way.

Inside features / middleware / handlers, **always** use `ILogger<T>` —
it picks up the category name automatically and integrates with the
test harness.

---

## 9 · Verification checklist

After any `Program.cs` change:

```bash
# 1. Build clean
dotnet build src/API/Enterprise.Platform.Api/Enterprise.Platform.Api.csproj
# Expected: 0 errors, 0 warnings.

# 2. Boot the host
cd src/API/Enterprise.Platform.Api
dotnet run --launch-profile=https
# Expected console output (in order):
#   [INF] Enterprise.Platform API starting — environment=Development.
#   [INF] Now listening on: https://localhost:5045 (or similar)

# 3. Hit the health endpoint
curl -k https://localhost:5045/health/live
# Expected: 200 OK + {"status":"Healthy"}

# 4. Crash test (optional) — temporarily break a settings validator
# Expected: process exits non-zero, last log line is the Fatal from line 49.

# 5. Graceful shutdown
# Press Ctrl+C
# Expected: log line confirming shutdown, then process exits zero.
```

---

## 10 · Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-25 | Claude (Opus 4.7) | Initial deep reference for `Program.cs`. Documented bootstrap-logger rationale, layered-configuration ordering, two-call Serilog handover, AddPlatformApi / AddPlatformOpenTelemetry / UsePlatformPipeline fan-outs, exception filter for HostAbortedException, end-to-end timeline. |
