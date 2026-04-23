# Architecture Comparison & Merger Analysis

> **Date:** 2026-04-23
> **Subject:** Side-by-side analysis of an external "Solution Architecture"
> design (handwritten/printed reference shared by the user) versus the
> current `Enterprise.Platform` codebase. Identifies what each does better,
> what to merge, what to deliberately reject.
>
> **Scope.** Production code only. Background services intentionally excluded
> per the original analysis instruction.
>
> **Companion docs.**
> - [`UI-Architecture.md`](UI-Architecture.md) — the SPA/UI architecture
> - [`BFF-Session-Flow.md`](BFF-Session-Flow.md) — auth sequence diagrams
> - [`../Recreation/00-INDEX.md`](../Recreation/00-INDEX.md) — full recreation guide
> - [`../Implementation/Compliance-TODO.md`](../Implementation/Compliance-TODO.md) — compliance gap tracker

## 1. Executive summary

The reference architecture and `Enterprise.Platform` solve the same general
problem (line-of-business enterprise application with web UI, identity,
business logic, persistence, cross-cutting concerns) but make materially
different decisions in **security**, **layer separation**, **code generation**,
**state management**, **observability**, and **resilience**.

| Dimension | Score |
|---|---|
| **Total dimensions compared** | 27 |
| **Wins for `Enterprise.Platform`** | 23 |
| **Wins for the reference architecture** | 4 |

Net verdict: **keep `Enterprise.Platform` as the foundation**; merge four
specific patterns from the reference diagram (Domain Services formalization,
named event-handler chains, PDF generator abstraction, notification service
abstraction).

## 2. Reference architecture (the diagram)

### 2.1 Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│ WEB LAYER ─ User-driven entry point                                     │
│ ┌─────────────────────────────┬─────────────────────────────┐           │
│ │ CLIENT SIDE                 │ SERVER SIDE                 │           │
│ │ Angular / PrimeNG           │ HTTP interceptors           │           │
│ │ NgRx · MSTP · DataStore     │ Token validation · logging  │           │
│ │                             │ error handling              │           │
│ │ MSAL interceptor            │ Controllers                 │           │
│ │ (bearer token in browser)   │ Validate · route to         │           │
│ │                             │ assembler                   │           │
│ │ Azure Entra ID              │                             │           │
│ │ OAuth 2.0 / OIDC authority  │                             │           │
│ └─────────────────────────────┴─────────────────────────────┘           │
├─────────────────────────────────────────────────────────────────────────┤
│ BACKGROUND SERVICES (excluded from this analysis)                       │
├─────────────────────────────────────────────────────────────────────────┤
│ APPLICATION LAYER ─ Shared by web + background; all business logic      │
│   Assembler  │  DTO  │  Service handlers  │  Publisher  │  Event handlers│
│   (DoFactory)│ (POCO)│                    │ (raises    │  (LDR → Cost   │
│                                              domain      → Retro → Cost │
│                                              events)     acct.)         │
├─────────────────────────────────────────────────────────────────────────┤
│ DOMAIN LAYER ─ Repository · Unit of work · invariant enforcement        │
│   Repository (Interfaces + EF Core impl)                                │
│   Unit of work (Atomic transaction scope)                               │
│   Domain services (Business invariants · grant lock rules)              │
├─────────────────────────────────────────────────────────────────────────┤
│ DATAMODEL LAYER ─ Persistence schema · EF Core · code generation        │
│   Entities (POCO · getDto() · UpdateDomain())                           │
│   DbContext (EF Core context · migrations)                              │
│   T4 templates (Code generation)                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ CROSS-CUTTING CONCERNS                                                  │
│   Cache (IMemoryCache) · Audit trail · Common (zero deps)               │
│   Database (SQL scripts · deploy pipeline · PS validation)              │
│   Exception logging · Email · PDF converters · Utilities                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Domain hint

The diagram references **LDR**, **SCEIS payroll**, **grants**, **allocations**,
**cost reprocessing**, **retro processing**. This appears to be a US
public-sector grant-management system — likely involving Labor Distribution
Reports from the South Carolina Enterprise Information System.

### 2.3 Key paradigms in the reference architecture

| Paradigm | What it implies |
|---|---|
| MSAL in browser | Bearer token stored in browser (`localStorage` or `sessionStorage`) |
| Assembler + DoFactory | Business logic concentrated in one service, dispatched by factory |
| EF Core repositories in Domain | Persistence concerns inside the Domain ring |
| Entities self-map (`getDto()` / `UpdateDomain()`) | Entity knows about its DTO shape |
| T4 templates | MSBuild-time string templating for entity code-gen |
| NgRx + MSTP + DataStore | Classic NgRx (pre-Signals) plus a separate state library |
| Explicit handler chain | LDR → Cost → Retro → Cost acct. cascade is visibly designed |

## 3. Our architecture (`Enterprise.Platform`)

### 3.1 Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│ BROWSER (single origin)                                                 │
│   Angular 21 SPA (NGRX Signals · PrimeNG 21 · Tailwind v4 · Vitest)     │
│   HTTP Interceptors (functional): correlation → tenant → security →     │
│     cache → dedup → loading → logging → retry → error                   │
│   NO TOKENS IN BROWSER — only HttpOnly+Secure+SameSite=Strict cookie    │
├─────────────────────────────────────────────────────────────────────────┤
│ Web.UI host (BFF — Microsoft.NET.Sdk.Web)                               │
│   Confidential OIDC client (Authorization Code + PKCE)                  │
│   PlatformAuthenticationSetup · PlatformAntiforgerySetup ·              │
│   PlatformCorsSetup · PlatformRateLimiterSetup · PlatformHealthCheckSetup│
│   SecurityHeadersMiddleware (CSP w/ per-request nonce, HSTS)            │
│   CorrelationIdMiddleware                                               │
│   ProxyController — server-side bearer attachment to downstream Api     │
│   AuthController — login/logout/session/me/permissions/me/profile       │
│   TokenRefreshService — proactive refresh-token rotation                │
│   GraphUserProfileService — Microsoft Graph /me with caching            │
├─────────────────────────────────────────────────────────────────────────┤
│ Api host (Microsoft.NET.Sdk.Web)                                        │
│   AuthenticationSetup — policy scheme by token issuer                   │
│     B2BScheme (JwtBearer + Microsoft.Identity.Web)                      │
│     B2CScheme (JwtBearer + Microsoft.Identity.Web)                      │
│     DevScheme (symmetric-key JWT — local dev only)                      │
│   ApiVersioningSetup · OpenApiSetup · HealthCheckSetup                  │
│   Middleware: CorrelationId · GlobalException · SecurityHeaders ·       │
│     RequestLogging · TenantResolution                                   │
│   Endpoint filters: Validation · Idempotency · Logging                  │
│   Endpoints: minimal API + controllers                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ Application (CQRS via custom Dispatcher — no MediatR)                   │
│   Abstractions/                                                         │
│   Behaviors/ (Validation → Transaction → Cache → Idempotency → Audit)   │
│   Common/                                                               │
│   Dispatcher/ (ICommand · IQuery · IPipelineBehavior)                   │
│   Features/ (per-aggregate command/query/handler folders)               │
├─────────────────────────────────────────────────────────────────────────┤
│ Domain (pure — zero infrastructure deps)                                │
│   Aggregates/ · Entities/ · ValueObjects/ · Enumerations/               │
│   Events/ (DomainEvent base + per-event records)                        │
│   Exceptions/ · Interfaces/ (IRepository<T>, IUnitOfWork)               │
│   Specifications/                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ Infrastructure (implements Application abstractions; integrates externals)│
│   BackgroundJobs/ · Caching/ · Common/ · Configuration/Validation/      │
│   Email/ · ExternalServices/ · FeatureFlags/ · FileStorage/             │
│   Identity/ (Authorization, OAuth, Services)                            │
│   Messaging/ (DomainEvents, IntegrationEvents, Outbox)                  │
│   MultiTenancy/                                                         │
│   Observability/ (StructuredLoggingSetup, OpenTelemetrySetup)           │
│   Persistence/ (Configurations, EventShopperDbContext, Interceptors,    │
│                 Migrations, Outbox, Seeding)                            │
│   Resilience/ · Security/DataEncryption/                                │
├─────────────────────────────────────────────────────────────────────────┤
│ Contracts (shared DTOs + settings POCOs)                                │
│   DTOs/ · Requests/ · Responses/ · Settings/                            │
├─────────────────────────────────────────────────────────────────────────┤
│ Shared (constants — zero dependencies)                                  │
│   Constants/ (ClaimTypes, ErrorCodes, HttpHeaderNames)                  │
└─────────────────────────────────────────────────────────────────────────┘
                                                                          
Sidecar: Worker host — IHostedService background jobs (excluded here)     
```

### 3.2 Key paradigms in our architecture

| Paradigm | What it implies |
|---|---|
| BFF cookie session | Tokens server-side only; browser carries opaque session cookie |
| CQRS via custom Dispatcher | Reads/writes split; pipeline behaviors layer cross-cutting concerns |
| Repository in Infrastructure | Domain depends on `IRepository<T>` interface; impl is in Infrastructure |
| Mapster for DTO ↔ Entity | Mapping config lives outside Domain; Domain has no presentation knowledge |
| Roslyn source generators | DtoGen analyzes syntax trees, emits source — modern code-gen |
| NGRX Signals | Signals-native state management, zoneless |
| Transactional outbox | Events published atomically with the SQL transaction |
| Multi-tenancy first-class | `MultiTenancySettings` + `ICurrentTenantService` + middleware |

## 4. Side-by-side comparison (full table)

| # | Dimension | Reference architecture | Our `Enterprise.Platform` | Winner | Why |
|---|---|---|---|---|---|
| 1 | **Auth — token storage** | MSAL → browser localStorage | BFF cookie session, **tokens never in browser** | **Ours** | XSS token-exfil window closed; CSP/CSRF/HttpOnly cookies layered |
| 2 | **Auth — server validation** | Controllers + HTTP interceptors | `Microsoft.Identity.Web` + JWT policy scheme (B2B/B2C/Dev fork by issuer) | **Ours** | Per-issuer scheme + per-tenant claim mapping + audience telemetry counter |
| 3 | **Layer separation** | Web → App → Domain → DataModel (4 layers) | Web/Api/BFF → Application → Domain + Infrastructure (Clean Arch + DDD) | **Ours** | Infrastructure as its own ring; Domain has zero infrastructure deps → fully testable |
| 4 | **Repository + UoW location** | In Domain (with EF Core impl) | Interfaces in Domain; **impl in Infrastructure** | **Ours** | Domain stays pure — no EF Core dep. Allows test-doubling Repository without spinning DbContext |
| 5 | **Business logic pattern** | Assembler (DoFactory) — single concentration point | **CQRS** with custom Dispatcher + per-aggregate Features folders | **Ours (with caveat)** | CQRS scales better as features grow; Assembler is simpler for small domains |
| 6 | **Code generation** | T4 templates (MSBuild-time) | **Roslyn-based DtoGen** (syntax-tree analysis → DTO + Mapster configs) | **Ours** | Roslyn understands C# semantics; T4 is string templating. Easier to extend |
| 7 | **Entity ↔ DTO mapping** | Entity has `getDto()` / `UpdateDomain()` instance methods | **Mapster TypeAdapterConfigs** registered via DI; entities have zero presentation knowledge | **Ours** | Domain stays clean. Mapping is a presentation concern |
| 8 | **Event publishing** | Publisher in App layer; explicit handler chain | **Transactional Outbox pattern** + Domain events + Integration events | **Ours** | Outbox guarantees publish-or-rollback atomicity; their pattern can lose events on rollback |
| 9 | **Validation** | Implicit in Controllers | **FluentValidation pipeline behavior** (runs before handler) + `ValidationEndpointFilter` on minimal APIs | **Ours** | Centralized; works for both Dispatcher-routed AND minimal-API endpoints |
| 10 | **State management (SPA)** | NgRx + MSTP + DataStore | **NGRX Signals** (signals-native, zoneless) | **Ours** | Modern signals API; less boilerplate; faster |
| 11 | **Configuration** | Not specified | `AddValidatedOptions<T>` + IOptions + ValidateOnStart | **Ours** | Misconfig fails at boot, not at first request |
| 12 | **Observability** | "Exception logging" mentioned | **Serilog + OpenTelemetry + correlation ID + custom metrics + health checks** | **Ours** | Three pillars wired uniformly; correlation traverses every hop |
| 13 | **Resilience** | Not explicit | `Microsoft.Extensions.Http.Resilience` (Polly under the hood) | **Ours** | First-class retry/circuit-breaker on outbound HTTP |
| 14 | **Caching** | IMemoryCache only | IMemoryCache + Redis (StackExchangeRedis) + cache pipeline behavior | **Ours** | Distributed cache for multi-instance; cache as a pipeline behavior auto-applies via `[Cacheable]` attribute |
| 15 | **Multi-tenancy** | Not mentioned | `MultiTenancySettings` + `ICurrentTenantService` + tenant-resolution middleware + per-tenant rate limit | **Ours** | First-class multi-tenant story |
| 16 | **Cross-cutting: PDF** | First-class cross-cutting concern (`PDF converters`) | **Not implemented** | **Reference** | If PDF generation is a real requirement, they have it; we don't |
| 17 | **Cross-cutting: Email** | First-class (`Email` — notifications, alerts) | `SmtpSettings` POCO exists but no service implementation | **Reference** | They have a working notification service; we have a placeholder |
| 18 | **Cross-cutting: Audit trail** | Listed as cross-cutting | `IAuditWriter` interface + `NullAuditWriter` impl + `AuditLogs` table schema | **Tie** | Both have plumbing; ours has DDL + interface but no real writer (D4-deferred) |
| 19 | **Domain Services pattern** | Explicitly named ("grant lock rules") | Implicit — we have Domain entities but don't have a `Domain/Services/` folder by convention | **Reference (educational)** | They make Domain Services explicit. We could do the same |
| 20 | **Named handler chains** | Visible (LDR → Cost → Retro → Cost acct.) | Outbox + DomainEvents/IntegrationEvents but chain ordering is implicit | **Reference (clarity)** | Their explicit chain is easier to reason about. We could document ours similarly |
| 21 | **Domain-driven naming** | Concrete: Grants, Tasks, Allocations, Priorities | Generic: EventShopper (sample) | **Reference** | Theirs is for a real production domain; ours is a platform shell |
| 22 | **Database deployment** | "Database" cross-cutting (SQL scripts + PS validation) | EF Core migrations + idempotent script generation | **Ours** | Migrations versioned with code; PowerShell-driven SQL deploys are 2010-era |
| 23 | **API versioning** | Not shown | `Asp.Versioning.Http` + URL-segment + header reader | **Ours** | First-class versioning |
| 24 | **Health checks** | Not shown | `/health/live` + `/health/ready` per host (anonymous, JSON shape consistent) | **Ours** | Required for k8s/load-balancer probes |
| 25 | **Rate limiting** | Not shown | Edge limiter (BFF) + global/per-tenant/per-user (Api) | **Ours** | Defense-in-depth |
| 26 | **CSRF** | Not shown | `[AutoValidateAntiforgeryToken]` + double-submit cookie + Angular's `withXsrfConfiguration` | **Ours** | Modern double-submit pattern |
| 27 | **CSP** | Not shown | Per-request nonce + header-delivered policy (replaces meta-tag) | **Ours** | Strict policy with future-proof nonce |

**Tally:** 23 ours / 4 reference / 1 tie

## 5. Why the four reference wins matter

### 5.1 Domain Services pattern (#19)

DDD recognizes three kinds of "services":

| Kind | Lives in | Example |
|---|---|---|
| **Domain Service** | Domain ring | "A grant cannot be locked when child allocations are in-flight" |
| **Application Service** | Application ring | "Process create-order command, persist, raise events" |
| **Infrastructure Service** | Infrastructure ring | `SmtpEmailSender`, `RedisCache`, `BlobFileStorage` |

The reference diagram explicitly carves out Domain Services. Our Domain
project has `Aggregates/`, `Entities/`, etc., but no canonical home for
**cross-aggregate invariant logic**. That logic ends up either:

- Squashed into an aggregate it doesn't belong to (violates SRP)
- Pushed up into an Application handler (couples business invariant to a
  use-case; can't reuse from another handler without duplication)

A `Domain/Services/` folder is the right home. **Action**: formalize it.

### 5.2 Named event-handler chains (#20)

In real business domains, events cascade — a payment posting raises a
ledger-entry event, which raises a budget-rebalance event, which raises an
audit event. The reference diagram makes this visible: `LDR → Cost → Retro
→ Cost acct.`

Our outbox pattern handles the mechanics, but the chain documentation is
implicit. When something breaks ("why did this audit row appear?"), tracing
back through anonymous handler registrations is painful.

**Action**: introduce a documentation convention so each handler announces
its upstream trigger and downstream events.

### 5.3 PDF generator abstraction (#16)

Real LOB applications need PDF output (statements, invoices, reports,
compliance documents). Adding it later means refactoring multiple Application
handlers to take a new dependency. Defining the abstraction now is cheap.

**Action**: add `IPdfGenerator` to `Application/Abstractions/`, add a
placeholder `Infrastructure/PdfGeneration/` implementation that throws
`NotImplementedException` until the first real consumer.

### 5.4 Notification service abstraction (#17)

Same shape as PDF. We have `SmtpSettings` but no `IEmailSender` /
`INotificationService`. Wiring the abstraction now means any future
"send X notification when Y happens" requirement is a one-line dependency
injection.

**Action**: add `INotificationService` to `Application/Abstractions/`, add
placeholder Infrastructure implementations for SMTP (and noted future
extensions for SMS/push).

## 6. Why the reference architecture's "losing" patterns are actually losses

These patterns exist in the reference diagram but we deliberately don't
adopt them:

### 6.1 MSAL in browser

Tokens in `localStorage` are accessible to any same-origin JavaScript. Any
XSS vulnerability anywhere in the app (or any of its dependencies) becomes
a token-exfiltration vulnerability. **Mitigation:** BFF cookie session —
tokens stay server-side. We made this trade in Phase 9.

### 6.2 EF Core in Domain

Couples the Domain ring to ORM. Tests can't run without a SQL Server (or
in-memory provider, which has different semantics from real SQL). Migration
to a different ORM (Dapper, source-gen ORM, NoSQL) requires rewriting Domain.

**Mitigation:** Domain has only `IRepository<T>` interface; Infrastructure
implements it.

### 6.3 Entity-knows-about-DTO (`getDto()` / `UpdateDomain()`)

Two API versions = `getDtoV1()` + `getDtoV2()` on the entity. Or
`getCustomerDto()` + `getCustomerSummaryDto()` + `getCustomerForExportDto()`
... entity becomes a junk drawer of presentation methods. Worse: refactoring
a DTO field changes the entity, breaking unrelated tests.

**Mitigation:** Mapster `TypeAdapterConfig` lives in
`Infrastructure/.../Mappings/`. Domain entity has zero knowledge of any DTO.

### 6.4 T4 templates

T4 is MSBuild-time string templating from 2008. The modern equivalent is
Roslyn source generators — they have access to the C# semantic model
(types, symbols, attributes). Easier to extend, type-safe, IDE-friendly.

**Mitigation:** `tools/Enterprise.Platform.DtoGen` uses `Microsoft.CodeAnalysis.CSharp`.

### 6.5 NgRx + MSTP + DataStore

Classic NgRx + a separate state library is two abstractions where one
suffices. Angular 17+ shipped Signals as a first-class primitive; the NgRx
team's signals-native library (NGRX Signals) is the recommended path
forward.

**Mitigation:** SPA uses `@ngrx/signals` 21 + `@angular-architects/ngrx-toolkit`.

### 6.6 No explicit BFF

OWASP, Microsoft, and Auth0 all recommend the BFF pattern for SPAs talking
to sensitive APIs. Direct SPA → API with bearer tokens is a 2018-era pattern.

**Mitigation:** Phase 9 stood up the full BFF.

### 6.7 No explicit observability story

Production incidents are reconstructed from logs + traces + metrics. "Just
log the exception" is necessary but insufficient for distributed systems.

**Mitigation:** Serilog + OpenTelemetry + correlation IDs everywhere.

### 6.8 No explicit configuration validation

Settings drift is a top-N cause of silent prod incidents. Catching it at
boot is far cheaper than catching it at first 401.

**Mitigation:** `AddValidatedOptions<T>` with `ValidateOnStart`.

### 6.9 No explicit resilience

Network calls without retry/circuit-breaker are brittle. Microsoft's
`Microsoft.Extensions.Http.Resilience` packages this out of the box.

**Mitigation:** Pinned in CPM; consumed by `IHttpClientFactory` registrations.

## 7. Comparison summary table (concise)

| Area | Reference | Ours | Action |
|---|---|---|---|
| Auth (browser) | MSAL bearer | BFF cookie | **Keep ours** |
| Auth (server) | Controllers + interceptors | Policy scheme + Microsoft.Identity.Web | **Keep ours** |
| Layers | 4 (Web/App/Domain/DataModel) | 5 (Web/Api/App/Infra/Domain) | **Keep ours** |
| Repository | EF Core in Domain | Interface in Domain, impl in Infra | **Keep ours** |
| Business logic | Assembler/DoFactory | CQRS Dispatcher + Behaviors | **Keep ours** |
| Code-gen | T4 templates | Roslyn source generators | **Keep ours** |
| Mapping | Entity self-map | Mapster | **Keep ours** |
| Events | Publisher cascade | Outbox + Domain/Integration | **Keep ours** |
| Validation | In Controllers | FluentValidation behavior | **Keep ours** |
| State (SPA) | NgRx + MSTP + DataStore | NGRX Signals | **Keep ours** |
| Configuration | Not specified | AddValidatedOptions + ValidateOnStart | **Keep ours** |
| Observability | Exception logging | Serilog + OTel + correlation | **Keep ours** |
| Resilience | Not specified | MS.Extensions.Http.Resilience | **Keep ours** |
| Caching | IMemoryCache | IMemoryCache + Redis + behavior | **Keep ours** |
| Multi-tenancy | Not specified | First-class | **Keep ours** |
| Domain Services | **Explicit** | Implicit | **Adopt theirs** |
| Handler chains | **Visible** | Implicit | **Adopt theirs** |
| PDF generation | **First-class** | Missing | **Adopt theirs** |
| Email/notifications | **First-class** | Settings only | **Adopt theirs** |
| API versioning | Not shown | Asp.Versioning | **Keep ours** |
| Health checks | Not shown | Per-host /health/* | **Keep ours** |
| Rate limiting | Not shown | Edge + per-tenant/user | **Keep ours** |
| CSRF | Not shown | Auto-validate + double-submit | **Keep ours** |
| CSP | Not shown | Per-request nonce | **Keep ours** |

## 8. Merger plan (the four items to adopt)

| # | Action | Files to add | Effort |
|---|---|---|---|
| 1 | Formalize Domain Services | `src/Core/Enterprise.Platform.Domain/Services/` + `README.md` + one example interface | 30 min |
| 2 | Document handler chains | `Docs/Architecture/EventHandlerChains.md` (template + example) | 30 min |
| 3 | PDF generator abstraction | `Application/Abstractions/IPdfGenerator.cs` + `Infrastructure/PdfGeneration/PdfGenerator.cs` (placeholder) | 30 min |
| 4 | Notification service abstraction | `Application/Abstractions/INotificationService.cs` + `Infrastructure/Notifications/SmtpEmailSender.cs` (placeholder) | 30 min |

Total: ~2 hours. Each item is small, self-contained, ships in one PR.

## 9. What this analysis is for

- **Reviewers** challenging architectural decisions: this doc shows we
  evaluated alternatives and chose deliberately.
- **New engineers** asking "why don't we use X?": this doc explains the
  trade-offs.
- **Future architecture pivots**: when revisiting decisions (5 years from
  now), this doc captures the 2026 reasoning so the choice can be re-evaluated
  with proper context.
- **Acquisition / merger / inherit-codebase scenarios**: comparing to other
  teams' architectures becomes a structured exercise instead of a
  whose-pattern-is-coolest argument.

## 10. Glossary (terms from the reference diagram)

| Term | Meaning |
|---|---|
| **MSTP** | Most likely "Microsoft TypeScript Provider" or a custom store wrapper. Not a widely-known acronym — context matters |
| **DoFactory** | A specific publisher of design-pattern reference implementations (dofactory.com); often used as shorthand for "GoF factory pattern" |
| **LDR** | Labor Distribution Report — payroll allocation across funding sources |
| **SCEIS** | South Carolina Enterprise Information System (US state government ERP) |
| **Retro** | Retroactive (re-)processing of payroll/cost allocations |
| **Grant lock** | Mechanism preventing modifications to a grant during in-flight allocation processing |
| **Cost acct.** | Cost accounting — final ledger posting |

## 11. Decision log

| Date | Decision | By |
|---|---|---|
| 2026-04-23 | Comparison analysis performed | This doc |
| 2026-04-23 | Approved adoption of items #1–#4 | User |

---

**Companion docs to read in conjunction:**

- [`UI-Architecture.md`](UI-Architecture.md) — UI architecture deep-dive
- [`BFF-Session-Flow.md`](BFF-Session-Flow.md) — auth sequence diagrams
- [`../Recreation/00-INDEX.md`](../Recreation/00-INDEX.md) — full recreation guide
- [`../Implementation/Compliance-TODO.md`](../Implementation/Compliance-TODO.md) — compliance gap tracker
- [`../Implementation/UI-Foundation-TODO.md`](../Implementation/UI-Foundation-TODO.md) — UI phase tracker
