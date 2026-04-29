# Enterprise.Platform — Recreation Guide

> **Purpose.** Comprehensive, step-by-step documentation that lets a new engineer
> (or future-you on a clean machine) recreate the **entire architecture** from
> scratch — solution structure, projects, packages, configuration, request
> flows, and verification — in the exact shape it stands today.
>
> **Out of scope.** Test projects (per the original ask). They appear in the
> solution layout for completeness but are NOT covered in detail.
>
> **What this guide is NOT.** A user manual for the running application. For
> auth diagnostics see `Docs/Observability/auth-smoke-runbook.md`; for compliance
> gaps see `Docs/Implementation/Compliance-TODO.md`; for the BFF session
> sequence diagrams see `Docs/Architecture/BFF-Session-Flow.md`.

## Reading order

Follow the guides **in numeric order** the first time. Each builds on the
previous one and the verification step at the end of each prevents you from
carrying broken state into the next.

| # | Doc | What it covers | Skip if… |
|---|---|---|---|
| 01 | [Prerequisites](01-Prerequisites.md) | All tools, SDKs, runtimes, install commands per OS, version pins, **verification commands per tool** | You're certain `dotnet --version`, `node --version`, `sqlcmd -?`, `ng version` all work |
| 02 | [Solution + project scaffolding + folder structures](02-Solution-And-Scaffolding.md) | `dotnet new sln`, per-project `dotnet new`, `dotnet sln add`, project references, default-template cleanup, **per-project folder structures** | Never |
| 03 | [Packages + coding standards](03-Packages-And-Standards.md) | `Directory.Packages.props` (Central Package Management), `Directory.Build.props`, `nuget.config`, `global.json`, naming conventions, source-generated logging, sealed-by-default | Never |
| 04 | [Configuration system + settings POCOs](04-Configuration-And-Settings.md) | Every settings class, `AddValidatedOptions` pattern, `appsettings.json` layering, env-var binding, user-secrets, Key Vault | Never |
| 05 | [Backend request flow (API + Worker)](05-Backend-Request-Flow.md) | API middleware order, endpoint filters, Validation→Transaction→Cache→Idempotency→Audit pipeline behaviors, custom Dispatcher, Worker job lifecycle | Never |
| 06 | [BFF + Frontend request flow + interceptors](06-BFF-And-Frontend-Flow.md) | BFF middleware/endpoint flow, **Angular HTTP interceptor chain (in execution order)**, end-to-end browser→BFF→API trace | Never |
| 07 | [Authentication + authorization](07-Authentication-And-Authorization.md) | Full OIDC code+PKCE, cookie session, refresh-token rotation, CSRF, Microsoft Graph token acquisition, API JWT validation policy scheme | Never |
| 08 | [Database + persistence (EF Core)](08-Database-And-Persistence.md) | DbContext per database, `IDbContextFactory`, configurations, interceptors, migrations, seeding, repositories, Unit of Work, outbox pattern | Never |
| 09 | [Observability (logging, metrics, tracing)](09-Observability.md) | Serilog + `StructuredLoggingSetup`, OpenTelemetry, OTLP exporter, custom metrics, correlation ID propagation, health checks per host | Never |
| 10 | [Verification checklist (per phase smoke)](10-Verification-Checklist.md) | Build, lint, arch:check, curl smokes, browser-based login, what "green" looks like at each stage | Never |
| 11 | [Reuse an existing App Registration (single-reg model)](11-Reuse-Existing-App-Registration.md) | Adapter recipe when you can't create a new Entra App Registration: collapses BFF-client + API-resource into one existing registration; portal walkthrough, scope add, role assignment, troubleshooting | You can create new App Registrations on the target tenant — use 07 + `Docs/Security/bff-oidc-setup.md` instead |

## Topology recap (one paragraph)

```
Browser (single origin: https://app.{env} in prod, http://localhost:5001 in dev)
   │ HttpOnly + Secure + SameSite=Strict session cookie (ep.bff.session)
   ▼
Web.UI host  (BFF — confidential OIDC client; serves Angular SPA + reverse-proxies XHRs)
   │   /api/proxy/{**path}  (server-side bearer token attached from cookie ticket)
   ▼
Api host  (validates Entra JWT; CQRS via custom Dispatcher; EF Core 10)
   │   EventShopperDbContext  (SQL Server)
   ▼
SQL Server  (one database per logical context — first is EventShopper)

Sidecars: Worker host (background jobs — outbox drain, cache warmup, audit retention)
Identity: Microsoft Entra ID (B2B today, B2C deferred)
Observability: Serilog → Console + Seq + OTLP collector (Application Insights / Grafana)
```

## Stack snapshot

| Layer | Technology | Version |
|---|---|---|
| Runtime | .NET SDK | 10.0.100 (allowPrerelease) |
| Web framework | ASP.NET Core | 10.0 |
| ORM | Entity Framework Core | 10.0.0 |
| API versioning | Asp.Versioning.Http | 8.1.0 |
| OpenAPI | Microsoft.AspNetCore.OpenApi + Swashbuckle | 10.0.3 / 7.2.0 |
| Identity | Microsoft.Identity.Web + JwtBearer + OpenIdConnect | 3.14.1 / 10.0.0 |
| Validation | FluentValidation | 11.11.0 |
| Mapping | Mapster | 7.4.0 |
| Resilience | Microsoft.Extensions.Http.Resilience | 10.0.0 |
| Caching | Microsoft.Extensions.Caching.StackExchangeRedis | 10.0.0 |
| Background jobs | Hangfire (planned), HostedService (current) | 1.8.17 |
| Observability | OpenTelemetry + Serilog | 1.12.0 / 9.0.0 |
| SPA framework | Angular | 21.2.x |
| SPA build | @angular/build (esbuild) | 21.2.x |
| SPA state | NGRX Signals | 21.0.1 |
| SPA UI kit | PrimeNG | 21.1.3 |
| SPA styling | Tailwind v4 | 4.2.1 |
| SPA tests | Vitest + Playwright + Storybook | 4.0.8 / 1.59.1 / 10.3.5 |
| Node | Node.js | ≥22.0.0 |
| npm | npm | ≥11.8.0 |
| Database | SQL Server | 2022 dev edition / Azure SQL prod |

## Project layout (production only)

```
Enterprise.Platform.slnx
├── src/
│   ├── API/Enterprise.Platform.Api/                 (Microsoft.NET.Sdk.Web)
│   ├── Batch/Enterprise.Platform.Worker/            (Microsoft.NET.Sdk.Worker)
│   ├── Contracts/
│   │   ├── Enterprise.Platform.Contracts/           (Microsoft.NET.Sdk — shared DTOs + settings)
│   │   └── Enterprise.Platform.Shared/              (Microsoft.NET.Sdk — constants + utilities)
│   ├── Core/
│   │   ├── Enterprise.Platform.Application/         (Microsoft.NET.Sdk — CQRS handlers + behaviors)
│   │   └── Enterprise.Platform.Domain/              (Microsoft.NET.Sdk — entities + value objects)
│   ├── Infrastructure/
│   │   └── Enterprise.Platform.Infrastructure/      (Microsoft.NET.Sdk — EF Core + persistence + adapters)
│   └── UI/
│       └── Enterprise.Platform.Web.UI/              (Microsoft.NET.Sdk.Web — BFF + Angular SPA)
├── tools/
│   └── Enterprise.Platform.DtoGen/                  (Microsoft.NET.Sdk — Roslyn DTO generator)
├── tests/                                           (excluded from this guide per the ask)
├── Directory.Build.props
├── Directory.Packages.props                         (Central Package Management — pins ALL versions)
├── global.json
├── nuget.config
└── Docs/                                            (you are here)
```

## Conventions you'll see throughout the guides

- **Central Package Management** — all `<PackageVersion>` declarations live in
  one file. Project `<PackageReference>`s carry no version attribute.
- **`net10.0`** target framework on every project (set in `Directory.Build.props`).
- **`Nullable enable`** + `TreatWarningsAsErrors` + `AnalysisLevel: latest-recommended`.
- **Source-generated logging** — `[LoggerMessage]` partial methods, never raw
  `_logger.LogInformation("msg {x}", x)`. CA1848 enforced.
- **Sealed by default** — every concrete class is `sealed` unless inheritance
  is required.
- **File-scoped namespaces** everywhere.
- **Primary constructors** for DI (`public sealed class Foo(IDep dep) : ...`).
- **`AddValidatedOptions<T>`** for every settings POCO — fail-fast at boot.
- **`IServiceCollection` extension methods** for composition (`AddPlatformXxx`).
- **`IApplicationBuilder` extension methods** for middleware (`UseXxx`).
- **`IEndpointRouteBuilder` extension methods** for route mapping (`MapXxx`).

## When this guide gets out of date

When a foundational change lands (new project, new top-level concept, version
pin bump on EF Core / .NET SDK, new identity flow), update the relevant doc
in the same PR as the code change. The guide is **load-bearing** for new
hires — drift defeats its purpose.
