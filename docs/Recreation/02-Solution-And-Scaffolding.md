# 02 — Solution + Project Scaffolding + Folder Structures

> **Output of this doc.** A working `Enterprise.Platform.slnx` with 8 production
> projects + 1 tool, each with its standard internal folder layout, all
> references wired, default templates cleaned. Build is clean (just empty —
> nothing to compile beyond default usings).
>
> **Prerequisites:** [`01-Prerequisites.md`](01-Prerequisites.md) verified.

## 1. Create the repo + solution root

```bash
# Pick your path
mkdir Enterprise.Platform
cd Enterprise.Platform
git init

# Solution file in slnx format (newer, JSON-friendly, supports folders)
dotnet new sln --name Enterprise.Platform --format slnx
```

You should now have `Enterprise.Platform.slnx`.

## 2. Folder skeleton

```bash
mkdir -p src/API src/Batch src/Contracts src/Core src/Infrastructure src/UI tools tests Docs
```

## 3. Create projects (in order — references depend on this order)

The reference graph (lower → higher means "lower depends on nothing, higher
depends on what's below"):

```
Domain                  ← no project deps
  ↑
Application             ← depends on Domain
  ↑
Infrastructure          ← depends on Application + Domain
  ↑                          (Contracts + Shared)
Api / Worker / Web.UI   ← depend on Infrastructure (which transitively brings the rest)
```

### 3.1 Shared utility project (constants, ErrorCodes, HttpHeaderNames)

```bash
dotnet new classlib -o src/Contracts/Enterprise.Platform.Shared --framework net10.0
rm src/Contracts/Enterprise.Platform.Shared/Class1.cs
dotnet sln add src/Contracts/Enterprise.Platform.Shared --solution-folder src/Contracts
```

### 3.2 Contracts project (DTOs, settings POCOs)

```bash
dotnet new classlib -o src/Contracts/Enterprise.Platform.Contracts --framework net10.0
rm src/Contracts/Enterprise.Platform.Contracts/Class1.cs
dotnet sln add src/Contracts/Enterprise.Platform.Contracts --solution-folder src/Contracts

# Contracts depends on Shared (for constants etc.)
dotnet add src/Contracts/Enterprise.Platform.Contracts reference src/Contracts/Enterprise.Platform.Shared
```

### 3.3 Domain project (entities, value objects, domain events)

```bash
dotnet new classlib -o src/Core/Enterprise.Platform.Domain --framework net10.0
rm src/Core/Enterprise.Platform.Domain/Class1.cs
dotnet sln add src/Core/Enterprise.Platform.Domain --solution-folder src/Core

# Domain has NO project references (it's the dependency root for the inner ring)
```

### 3.4 Application project (CQRS handlers, behaviors, abstractions)

```bash
dotnet new classlib -o src/Core/Enterprise.Platform.Application --framework net10.0
rm src/Core/Enterprise.Platform.Application/Class1.cs
dotnet sln add src/Core/Enterprise.Platform.Application --solution-folder src/Core

# Application depends on Domain + Contracts + Shared
dotnet add src/Core/Enterprise.Platform.Application reference src/Core/Enterprise.Platform.Domain
dotnet add src/Core/Enterprise.Platform.Application reference src/Contracts/Enterprise.Platform.Contracts
dotnet add src/Core/Enterprise.Platform.Application reference src/Contracts/Enterprise.Platform.Shared
```

### 3.5 Infrastructure project (EF Core, persistence, external adapters)

```bash
dotnet new classlib -o src/Infrastructure/Enterprise.Platform.Infrastructure --framework net10.0
rm src/Infrastructure/Enterprise.Platform.Infrastructure/Class1.cs
dotnet sln add src/Infrastructure/Enterprise.Platform.Infrastructure --solution-folder src/Infrastructure

# Infrastructure depends on Application + Domain (it implements Application abstractions)
dotnet add src/Infrastructure/Enterprise.Platform.Infrastructure reference src/Core/Enterprise.Platform.Application
dotnet add src/Infrastructure/Enterprise.Platform.Infrastructure reference src/Core/Enterprise.Platform.Domain
dotnet add src/Infrastructure/Enterprise.Platform.Infrastructure reference src/Contracts/Enterprise.Platform.Contracts
dotnet add src/Infrastructure/Enterprise.Platform.Infrastructure reference src/Contracts/Enterprise.Platform.Shared
```

### 3.6 API host (Microsoft.NET.Sdk.Web)

```bash
dotnet new web -o src/API/Enterprise.Platform.Api --framework net10.0
dotnet sln add src/API/Enterprise.Platform.Api --solution-folder src/API

# References — Api uses Infrastructure (which transitively brings Application + Domain)
dotnet add src/API/Enterprise.Platform.Api reference src/Infrastructure/Enterprise.Platform.Infrastructure
dotnet add src/API/Enterprise.Platform.Api reference src/Contracts/Enterprise.Platform.Contracts
dotnet add src/API/Enterprise.Platform.Api reference src/Contracts/Enterprise.Platform.Shared
```

### 3.7 Worker host (Microsoft.NET.Sdk.Worker)

```bash
dotnet new worker -o src/Batch/Enterprise.Platform.Worker --framework net10.0
dotnet sln add src/Batch/Enterprise.Platform.Worker --solution-folder src/Batch

dotnet add src/Batch/Enterprise.Platform.Worker reference src/Infrastructure/Enterprise.Platform.Infrastructure
dotnet add src/Batch/Enterprise.Platform.Worker reference src/Contracts/Enterprise.Platform.Contracts
dotnet add src/Batch/Enterprise.Platform.Worker reference src/Contracts/Enterprise.Platform.Shared
```

### 3.8 Web.UI host (Microsoft.NET.Sdk.Web — the BFF)

```bash
dotnet new web -o src/UI/Enterprise.Platform.Web.UI --framework net10.0
dotnet sln add src/UI/Enterprise.Platform.Web.UI --solution-folder src/UI

# Web.UI is leaf — it doesn't need Application/Domain (it's a thin BFF)
# It DOES need Infrastructure for shared services (StructuredLoggingSetup) + Contracts/Shared
dotnet add src/UI/Enterprise.Platform.Web.UI reference src/Infrastructure/Enterprise.Platform.Infrastructure
dotnet add src/UI/Enterprise.Platform.Web.UI reference src/Contracts/Enterprise.Platform.Contracts
dotnet add src/UI/Enterprise.Platform.Web.UI reference src/Contracts/Enterprise.Platform.Shared
```

### 3.9 DtoGen tool (Roslyn-based code generator)

```bash
dotnet new console -o tools/Enterprise.Platform.DtoGen --framework net10.0
dotnet sln add tools/Enterprise.Platform.DtoGen --solution-folder tools

# Tool has no project refs (uses Microsoft.CodeAnalysis.CSharp NuGet)
```

### 3.10 Verify the layout

```bash
dotnet sln list
# Expect: 8 production projects + 1 tool, ALL listed
```

## 4. Default-template cleanup

`dotnet new web` and `dotnet new worker` ship with placeholder code. Clean each:

### 4.1 API project (`src/API/Enterprise.Platform.Api/`)

The default `Program.cs` has a "Hello World" minimal API — replace it later
with the real composition (see `05-Backend-Request-Flow.md`). For now, gut it
to a 3-line placeholder so it builds:

```csharp
// src/API/Enterprise.Platform.Api/Program.cs
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
await app.RunAsync().ConfigureAwait(false);
```

Delete `Properties/launchSettings.json`'s default profiles or update them to
the project's actual ports (see doc 05).

### 4.2 Worker project

Default `Worker.cs` and `Program.cs` are placeholders. You'll wire real jobs
later. Leave as-is for now — they build clean.

### 4.3 Web.UI project

`dotnet new web` produces a `Properties/launchSettings.json` with random ports.
Update to bind `http://localhost:5001` (matches the Entra-registered redirect URIs):

```json
{
  "$schema": "https://json.schemastore.org/launchsettings.json",
  "profiles": {
    "http": {
      "commandName": "Project",
      "dotnetRunMessages": true,
      "launchBrowser": false,
      "applicationUrl": "http://localhost:5001",
      "environmentVariables": { "ASPNETCORE_ENVIRONMENT": "Development" }
    },
    "https": {
      "commandName": "Project",
      "dotnetRunMessages": true,
      "launchBrowser": false,
      "applicationUrl": "https://localhost:7197;http://localhost:5001",
      "environmentVariables": { "ASPNETCORE_ENVIRONMENT": "Development" }
    }
  }
}
```

### 4.4 Verify everything builds

```bash
dotnet build
# Expected: 0 warnings / 0 errors. ALL projects compile (empty libraries
# + skeleton hosts).
```

## 5. Per-project folder structures

Create these folders eagerly (they'll be populated as you walk through later
docs). Empty folders need a `.gitkeep` to be tracked by git.

### 5.1 `Enterprise.Platform.Shared`

Tiny — just the constants library.

```
src/Contracts/Enterprise.Platform.Shared/
├── Constants/
│   ├── ClaimTypes.cs              (custom claim type strings)
│   ├── ErrorCodes.cs              (canonical error code constants)
│   └── HttpHeaderNames.cs         (X-Correlation-ID, X-Tenant-ID, etc.)
└── Enterprise.Platform.Shared.csproj
```

```bash
mkdir -p src/Contracts/Enterprise.Platform.Shared/Constants
touch src/Contracts/Enterprise.Platform.Shared/Constants/.gitkeep
```

### 5.2 `Enterprise.Platform.Contracts`

Shared DTOs + settings POCOs. Settings used by multiple hosts live here.

```
src/Contracts/Enterprise.Platform.Contracts/
├── DTOs/
│   └── EventShopper/                   (per-context DTOs — auto-generated by DtoGen)
├── Requests/                           (incoming request shapes)
├── Responses/                          (outgoing response envelopes — ApiResponse<T>, PagedResponse<T>)
├── Settings/                           (settings POCOs shared across hosts)
│   ├── ObservabilitySettings.cs
│   ├── DatabaseSettings.cs
│   ├── EntraIdSettings.cs
│   ├── EntraIdB2CSettings.cs
│   ├── JwtSettings.cs
│   ├── CorsSettings.cs
│   ├── CacheSettings.cs
│   ├── MultiTenancySettings.cs
│   ├── RateLimitSettings.cs
│   ├── AzureSettings.cs
│   ├── SmtpSettings.cs
│   └── AppSettings.cs
└── Enterprise.Platform.Contracts.csproj
```

```bash
mkdir -p src/Contracts/Enterprise.Platform.Contracts/{DTOs/EventShopper,Requests,Responses,Settings}
touch src/Contracts/Enterprise.Platform.Contracts/DTOs/EventShopper/.gitkeep
touch src/Contracts/Enterprise.Platform.Contracts/Requests/.gitkeep
touch src/Contracts/Enterprise.Platform.Contracts/Responses/.gitkeep
touch src/Contracts/Enterprise.Platform.Contracts/Settings/.gitkeep
```

### 5.3 `Enterprise.Platform.Domain`

Pure domain model. **No project references.** No external NuGet deps.

```
src/Core/Enterprise.Platform.Domain/
├── Aggregates/                         (aggregate roots — entities + invariants)
├── Entities/                           (non-root entities)
├── ValueObjects/                       (immutable value types)
├── Enumerations/                       (smart enums; rich-behavior enums)
├── Events/                             (domain events — fired from aggregates)
├── Exceptions/                         (domain-specific exceptions)
├── Interfaces/                         (IRepository<T>, IUnitOfWork — abstractions)
├── Specifications/                     (specification pattern for query composition)
└── Enterprise.Platform.Domain.csproj
```

```bash
mkdir -p src/Core/Enterprise.Platform.Domain/{Aggregates,Entities,ValueObjects,Enumerations,Events,Exceptions,Interfaces,Specifications}
for d in src/Core/Enterprise.Platform.Domain/{Aggregates,Entities,ValueObjects,Enumerations,Events,Exceptions,Interfaces,Specifications}; do touch "$d/.gitkeep"; done
```

### 5.4 `Enterprise.Platform.Application`

CQRS handlers + pipeline behaviors + abstractions for infrastructure.

```
src/Core/Enterprise.Platform.Application/
├── Abstractions/                       (interfaces Infrastructure implements)
│   ├── ICurrentUserService.cs
│   ├── ICurrentTenantService.cs
│   ├── IAuditWriter.cs
│   └── IDateTimeProvider.cs
├── Behaviors/                          (pipeline behaviors)
│   ├── ValidationBehavior.cs
│   ├── TransactionBehavior.cs
│   ├── CacheBehavior.cs
│   ├── IdempotencyBehavior.cs
│   └── AuditBehavior.cs
├── Common/                             (shared types — CommandResult<T>, etc.)
├── Dispatcher/                         (custom CQRS dispatcher — see doc 05)
│   ├── ICommand.cs
│   ├── IQuery.cs
│   ├── IPipelineBehavior.cs
│   └── Dispatcher.cs
├── Features/                           (per-aggregate feature folders)
│   ├── AuditLog/
│   ├── EventShopper/
│   ├── Identity/
│   └── Tenants/
└── Enterprise.Platform.Application.csproj
```

```bash
mkdir -p src/Core/Enterprise.Platform.Application/{Abstractions,Behaviors,Common,Dispatcher,Features/{AuditLog,EventShopper,Identity,Tenants}}
for d in src/Core/Enterprise.Platform.Application/{Abstractions,Behaviors,Common,Dispatcher,Features/AuditLog,Features/EventShopper,Features/Identity,Features/Tenants}; do touch "$d/.gitkeep"; done
```

### 5.5 `Enterprise.Platform.Infrastructure`

The biggest project. Implements Application abstractions + houses all
external integrations.

```
src/Infrastructure/Enterprise.Platform.Infrastructure/
├── BackgroundJobs/                     (Hangfire / hosted-service implementations)
├── Caching/                            (Redis + in-memory cache adapters)
├── Common/                             (NullAuditWriter, etc.)
├── Configuration/
│   └── Validation/                     (IValidateOptions implementations)
├── Email/                              (SMTP adapter)
├── ExternalServices/                   (third-party HTTP integrations)
├── FeatureFlags/                       (toggle providers)
├── FileStorage/                        (Azure Blob, local FS adapters)
├── Identity/
│   ├── Authorization/                  (custom AuthorizationHandlers)
│   ├── OAuth/                          (token-issue helpers — D4)
│   └── Services/                       (CurrentUser/CurrentTenant impls)
├── Messaging/
│   ├── DomainEvents/                   (in-process event dispatch)
│   ├── IntegrationEvents/              (cross-bounded-context events)
│   └── Outbox/                         (transactional outbox pattern)
├── MultiTenancy/                       (tenant resolution + scoping)
├── Observability/
│   ├── StructuredLoggingSetup.cs       (Serilog composition — used by all hosts)
│   ├── OpenTelemetrySetup.cs           (OTel registration)
│   └── BusinessMetrics.cs              (custom Meter)
├── Persistence/
│   ├── Configurations/                 (per-entity IEntityTypeConfiguration<T>)
│   ├── EventShopper/
│   │   └── Contexts/
│   │       └── EventShopperDbContext.cs
│   ├── Interceptors/                   (audit, soft-delete, encryption)
│   ├── Migrations/                     (auto-generated by `dotnet ef`)
│   ├── Outbox/                         (OutboxMessage entity + processor)
│   └── Seeding/                        (lookup-data seeding)
├── Resilience/                         (Polly-equivalent via Microsoft.Extensions.Resilience)
├── Security/
│   └── DataEncryption/                 (column-level encryption helpers)
└── Enterprise.Platform.Infrastructure.csproj
```

```bash
mkdir -p src/Infrastructure/Enterprise.Platform.Infrastructure/{BackgroundJobs,Caching,Common,Configuration/Validation,Email,ExternalServices,FeatureFlags,FileStorage,Identity/{Authorization,OAuth,Services},Messaging/{DomainEvents,IntegrationEvents,Outbox},MultiTenancy,Observability,Persistence/{Configurations,EventShopper/Contexts,Interceptors,Migrations,Outbox,Seeding},Resilience,Security/DataEncryption}
find src/Infrastructure/Enterprise.Platform.Infrastructure -type d -empty -exec touch {}/.gitkeep \;
```

### 5.6 `Enterprise.Platform.Api`

```
src/API/Enterprise.Platform.Api/
├── Common/                             (LogMessages.cs etc.)
├── Configuration/                      (Setup helpers)
│   ├── AuthenticationSetup.cs
│   ├── ApiVersioningSetup.cs
│   ├── CompressionSetup.cs
│   ├── HealthCheckSetup.cs
│   ├── OpenApiSetup.cs
│   └── RateLimitingSetup.cs
├── Endpoints/
│   └── v1/                             (per-version, per-area endpoint groups)
│       ├── EventShopper/
│       │   └── RolesEndpoints.cs
│       ├── HealthEndpoints.cs
│       └── WhoAmIEndpoint.cs
├── Extensions/
│   ├── ServiceCollectionExtensions.cs  (AddPlatformApi composition)
│   └── WebApplicationExtensions.cs     (UsePlatformPipeline middleware order)
├── Filters/                            (endpoint filters)
│   ├── IdempotencyEndpointFilter.cs
│   ├── LogEndpointFilter.cs
│   └── ValidationEndpointFilter.cs
├── Middleware/
│   ├── CorrelationIdMiddleware.cs
│   ├── GlobalExceptionMiddleware.cs
│   ├── RequestLoggingMiddleware.cs
│   ├── SecurityHeadersMiddleware.cs
│   └── TenantResolutionMiddleware.cs
├── Properties/launchSettings.json
├── appsettings.json
├── appsettings.Development.json
├── Program.cs
└── Enterprise.Platform.Api.csproj
```

```bash
mkdir -p src/API/Enterprise.Platform.Api/{Common,Configuration,Endpoints/v1/EventShopper,Extensions,Filters,Middleware}
find src/API/Enterprise.Platform.Api -type d -empty -exec touch {}/.gitkeep \;
```

### 5.7 `Enterprise.Platform.Worker`

```
src/Batch/Enterprise.Platform.Worker/
├── Jobs/
│   ├── CacheWarmupJob.cs
│   ├── OutboxProcessorJob.cs
│   └── AuditRetentionJob.cs
├── Properties/launchSettings.json
├── appsettings.json
├── appsettings.Development.json
├── Program.cs
└── Enterprise.Platform.Worker.csproj
```

```bash
mkdir -p src/Batch/Enterprise.Platform.Worker/Jobs
touch src/Batch/Enterprise.Platform.Worker/Jobs/.gitkeep
```

### 5.8 `Enterprise.Platform.Web.UI` (BFF)

This is the canonical post-refactor layout. **No `Bff*` prefixes** — namespace
+ folder do the disambiguating.

```
src/UI/Enterprise.Platform.Web.UI/
├── ClientApp/                          (Angular SPA — see Angular section below)
├── Configuration/                      (Settings POCOs ONLY — IOptions<T> targets)
│   ├── AzureAdSettings.cs
│   ├── ProxySettings.cs
│   └── SpaHostingSettings.cs
├── Setup/                              (IServiceCollection extension methods)
│   ├── PlatformAuthenticationSetup.cs
│   ├── PlatformAntiforgerySetup.cs
│   ├── PlatformCorsSetup.cs
│   ├── PlatformHealthCheckSetup.cs
│   └── PlatformRateLimiterSetup.cs
├── Middleware/                         (IApplicationBuilder middleware)
│   ├── CorrelationIdMiddleware.cs
│   └── SecurityHeadersMiddleware.cs
├── Endpoints/                          (IEndpointRouteBuilder mappers)
│   ├── HealthEndpoints.cs
│   └── SpaFallbackEndpoint.cs
├── Services/                           (DI-registered runtime services)
│   ├── Authentication/
│   │   ├── EntraTokenResponse.cs
│   │   └── TokenRefreshService.cs
│   ├── Graph/
│   │   ├── GraphConstants.cs
│   │   ├── GraphUserProfile.cs
│   │   └── GraphUserProfileService.cs
│   └── HealthChecks/
│       └── DownstreamApiHealthCheck.cs
├── Observability/
│   └── SessionMetrics.cs
├── Controllers/
│   ├── AntiForgeryController.cs
│   ├── AuthController.cs
│   ├── ProxyController.cs
│   └── Models/                         (JSON contract DTOs)
│       ├── EffectivePermissions.cs
│       ├── MeProfileResponse.cs
│       └── SessionInfo.cs
├── wwwroot/                            (prod SPA build lands here)
├── Properties/launchSettings.json
├── appsettings.json
├── appsettings.Development.json
├── Program.cs
└── Enterprise.Platform.Web.UI.csproj
```

```bash
mkdir -p src/UI/Enterprise.Platform.Web.UI/{Configuration,Setup,Middleware,Endpoints,Services/{Authentication,Graph,HealthChecks},Observability,Controllers/Models,wwwroot}
find src/UI/Enterprise.Platform.Web.UI -type d -empty -not -path "*/wwwroot*" -exec touch {}/.gitkeep \;
```

### 5.9 `Enterprise.Platform.DtoGen` (tool)

```
tools/Enterprise.Platform.DtoGen/
├── Generators/                         (Roslyn syntax tree → DTO + Mapster config)
├── Templates/                          (string templates for generated source)
├── Program.cs                          (CLI entrypoint)
└── Enterprise.Platform.DtoGen.csproj
```

```bash
mkdir -p tools/Enterprise.Platform.DtoGen/{Generators,Templates}
find tools/Enterprise.Platform.DtoGen -type d -empty -exec touch {}/.gitkeep \;
```

## 6. Angular SPA scaffold inside Web.UI

The SPA lives **inside** the Web.UI project at `ClientApp/`. The host serves it
in prod (from `wwwroot/`) and proxies to it from a watch directory in dev.

```bash
cd src/UI/Enterprise.Platform.Web.UI
npm create @angular/cli@21 -- ClientApp \
  --routing=true \
  --style=css \
  --skip-tests=true \
  --strict=true \
  --standalone \
  --skip-git=true \
  --package-manager=npm

cd ClientApp
# Tier folders the dependency-cruiser will enforce
mkdir -p src/app/{config,core,shared,layouts,features,environments}
touch src/app/{config,core,shared,layouts,features}/.gitkeep
mkdir -p src/environments
touch src/environments/.gitkeep
```

(Detailed Angular config — Tailwind v4 + PrimeNG 21 + NGRX Signals + Vitest +
Storybook + Playwright + dependency-cruiser — covered in
[`06-BFF-And-Frontend-Flow.md`](06-BFF-And-Frontend-Flow.md).)

## 7. Verify the scaffold

```bash
cd ../../..   # back to repo root
dotnet build
# Expected: 0 warnings / 0 errors. All 9 projects compile (mostly empty).

# SPA-side
cd src/UI/Enterprise.Platform.Web.UI/ClientApp
npm install --legacy-peer-deps
npm run build
# Expected: Angular default app builds cleanly.
```

## 8. Initial git commit

```bash
cd ../../..   # back to repo root
git add .
git commit -m "scaffold: initial solution + project skeleton"
```

---

## Quick reference — solution add-folder mapping

| Project path | Solution folder |
|---|---|
| `src/API/...` | `/src/API/` |
| `src/Batch/...` | `/src/Batch/` |
| `src/Contracts/...` | `/src/Contracts/` |
| `src/Core/...` | `/src/Core/` |
| `src/Infrastructure/...` | `/src/Infrastructure/` |
| `src/UI/...` | `/src/UI/` |
| `tools/...` | `/tools/` |
| `tests/...` | `/tests/` (out of scope here) |

The slnx file ends up looking exactly like `Enterprise.Platform.slnx` at repo
root. If you need to add a folder manually, edit the slnx directly:

```xml
<Folder Name="/src/Core/">
  <Project Path="src/Core/Enterprise.Platform.Application/..." />
</Folder>
```

---

**Next:** [`03-Packages-And-Standards.md`](03-Packages-And-Standards.md) —
add `Directory.Packages.props`, `Directory.Build.props`, `nuget.config`,
`global.json`, then layer in package references on each project.
