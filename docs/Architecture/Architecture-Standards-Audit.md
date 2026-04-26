# Architecture Standards Audit

**Status:** 🟢 Findings closed by Phase 2 — see [`Phase-2-Completion.md`](./Phase-2-Completion.md) for the finding-by-finding outcome table.
**Authored:** 2026-04-25.
**Companion:** [`Single-Tenant-Migration-Plan.md`](./Single-Tenant-Migration-Plan.md) (Phase 1) · [`Phase-2-Completion.md`](./Phase-2-Completion.md) (Phase 2 outcomes).

> **Live status of every finding lives in `Phase-2-Completion.md` §0.** This document is the original audit context retained for historical reference + rationale. When in doubt, the completion doc is authoritative.

---

## 0 · Executive summary

The .NET backend at `src/` demonstrates **exceptional Clean Architecture / DDD / CQRS discipline**. Domain stays infrastructure-agnostic; handlers delegate persistence to repositories; pipeline behaviors enforce cross-cutting concerns consistently. Strong security posture (HTTPS + CSP + HSTS + bearer auth + claim-based authorization), comprehensive observability (Serilog + OpenTelemetry + correlation IDs), and resilience patterns (Polly + idempotency + RowVersion concurrency).

**Critical gaps are minimal.** Most findings are architectural enhancements and polish, not fundamental rewrites. Production-ready in the core layers; enhancements needed in peripheral areas (caching invalidation strategy, XML docs, validation pipeline placement).

**Severity distribution:**
- **P0 (must fix before production):** 2 findings
- **P1 (high priority, address soon):** 9 findings
- **P2 (architectural quality):** 8 findings
- **P3 (polish / future):** 6 findings
- **What's already good:** 10 patterns called out

**Recommendation:** Phase 2 should ship the 2 P0 fixes plus the top 5 P1 fixes in the next iteration. The remaining items are pull-request-sized cleanups that can land opportunistically.

---

## 1 · P0 findings — must fix before production

### P0-1 · Correlation ID propagation to async background work
**Where:** `Infrastructure/Persistence/Interceptors/DomainEventDispatchInterceptor.cs:74` + handlers in `Application/Behaviors/AuditBehavior.cs`
**Current state:** Domain events fire after `SaveChanges` succeeds; correlation ID from Serilog `LogContext` is captured but not propagated into async event-handler tasks. If a handler spawns off-thread work (future: outbox processor), trace context is lost.
**Industry standard:** Serilog `LogContext` + OpenTelemetry trace context must flow through every async path. ASP.NET Core 8+ supports `Activity` context propagation natively when configured.
**Fix:** Wrap domain-event dispatch in `await Task.Run(async () => { using (LogContext.Push(...)) { ... } })`, OR (preferred) embed W3C trace context on `IDomainEvent` and re-establish via `Activity.Current = ...` in handlers.
**Effort:** M

### P0-2 · Repository SaveChanges coupling breaks transactional semantics
**Where:** `Infrastructure/Persistence/EventShopper/Repositories/RolesRepository.cs:86, 117, 148` (these specific files are deleted in Phase 1, but the *pattern* must not be repeated when new repos are written)
**Current state:** `IRolesRepository.CreateAsync()` / `UpdateAsync()` / `DeleteAsync()` each call `await _context.SaveChangesAsync()` directly. This violates the transactional-boundary model: handlers expect `TransactionBehavior` to wrap them in a transaction, but the repository is already persisting mid-handler. If a handler calls multiple repos and the second throws, the first is already committed (data corruption).
**Industry standard:** Repository = staging operation (`Add` / `Update` / `Remove`). Handler = orchestration. Single `SaveChanges` at handler exit (via `IUnitOfWork`). See Domain.Interfaces.IUnitOfWork — `SaveChangesAsync`, `BeginTransactionAsync`, `CommitTransactionAsync` are the explicit boundaries.
**Fix:** When new repositories are written (Phase 1+), prohibit direct `SaveChangesAsync` calls inside repos. Methods return staged entities or `void`. Handlers inject `IUnitOfWork` (or it's flushed by `TransactionBehavior` MediatR pipeline behavior). Add a `RepositoryShouldNotPersistAnalyzer` Roslyn analyzer that flags `_context.SaveChangesAsync` inside any class implementing `*Repository`.
**Effort:** M (analyzer); the pattern itself is enforced by code review going forward.

---

## 2 · P1 findings — high priority

### P1-1 · Validation filter applied AFTER body binding — coercion errors skip validation
**Where:** `API/Endpoints/v1/EventShopper/RolesEndpoints.cs:60, 71, 85` (deleted in Phase 1; pattern persists in `Filters/ValidationEndpointFilter.cs`)
**Current state:** Validation filter runs INSIDE the endpoint handler (post-binding). If request JSON cannot coerce to DTO (e.g., `"priority": "abc"` instead of int), binding fails before the filter runs and returns a raw 400 without RFC 7807 problem details.
**Industry standard:** Validation should sit BETWEEN model binding and handler execution. ASP.NET Core's model-state validation errors (binding failures) must also be caught and returned as `ProblemDetailsExtended`.
**Fix:** Add a global endpoint filter that catches binding failures and converts to `ProblemDetailsExtended`. Either via `IExceptionHandler` for `BadHttpRequestException` or a custom `BindingValidationFilter` registered before the existing `ValidationEndpointFilter`.
**Effort:** S

### P1-2 · Missing EF Core retry policy on transient DB failures
**Where:** `Infrastructure/DependencyInjection.cs:120-121`
**Current state:** UoW + DbContext registered without `.EnableRetryOnFailure(...)`. Transient SQL timeouts, connection resets, deadlock victims, and temp connection failures are NOT automatically retried.
**Industry standard:** EF Core 8+ supports `.EnableRetryOnFailure(maxRetryCount, maxRetryDelay, errorNumbersToAdd)` on `DbContextOptions`. Production apps retry deadlocks (3 attempts, exponential backoff, configurable) and transient connection errors.
**Fix:** In `AddAppDb` (renamed from `AddEventShopperDb`), add to `UseSqlServer(connectionString, sql => { sql.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorNumbersToAdd: null); })`. Configure via `DatabaseSettings.RetryCount` / `RetryDelaySeconds`. Document in DatabaseSettings XML doc.
**Effort:** S

### P1-3 · Domain event handlers may fail silently (best-effort dispatch)
**Where:** `Infrastructure/Persistence/Interceptors/DomainEventDispatchInterceptor.cs:66-75`
**Current state:** After `SaveChanges` succeeds, events dispatch. If a handler throws, exception propagates back, but the write has already committed (non-recoverable state per the file's own comment). No timeout, no circuit-breaker, no fallback log.
**Industry standard:** Domain-event dispatch should be:
1. Idempotent (guaranteed by design)
2. Bounded (timeout + circuit-breaker per handler type)
3. Observable (every success/failure logged with correlation ID + request context)
   High-value side effects (email, payment webhooks) should live in the Outbox, not the sync dispatcher.
**Fix:**
1. Add timeout to `DomainEventDispatcher`: `await dispatcher.DispatchAsync(events, TimeSpan.FromSeconds(10), cancellationToken)`.
2. Log entry/exit per handler + elapsed time + exception if any.
3. Document: "Handlers must be idempotent and < 1s. Cross-service calls go through the Outbox, not here."
4. Add Polly circuit-breaker per handler type if cross-service calls are involved.
**Effort:** M

### P1-4 · No concurrency token on every entity (inconsistent across DB-first scaffold)
**Where:** Across DB-first scaffolded entities (deleted in Phase 1; pattern matters going forward)
**Current state:** Some scaffolded entities had `RowVersion`; others did not. Application has no way to opt INTO optimistic concurrency at the entity level.
**Industry standard:** Every entity that can be updated in production must have a concurrency token (`RowVersion byte[]` for SQL Server). Code-first via `BaseEntity` enforces this automatically. DB-first requires explicit schema discipline.
**Fix:** With Phase 1 ripping all entities and switching to code-first via `BaseEntity` inheritance, this is automatically resolved. Document in `Domain/Entities/README.md`: "All entities inherit `BaseEntity` (or descendants), which guarantees `RowVersion` is present."
**Effort:** S (now an enforced default)

### P1-5 · No distributed rate limiting across horizontally-scaled instances
**Where:** `API/Configuration/RateLimitingSetup.cs` (in-memory rate limiter from ASP.NET Core)
**Current state:** Rate limiter is in-memory. Multi-instance deployments allow N req/min PER instance, not globally. DDoS / bot mitigation is instance-local.
**Industry standard:** Use distributed rate limiting (Redis-backed, custom header partition, or reverse-proxy rules like Azure API Gateway / Cloudflare) for production multi-instance deployments.
**Fix:** When the deployment story moves to multi-instance, either (a) swap to a Redis-backed rate-limiter store, or (b) defer rate limiting to a reverse-proxy / API gateway layer and document the decision. For single-instance deployments, in-memory is fine.
**Effort:** M (implementation), S (decision-doc + defer)

### P1-6 · Specification evaluator may N+1 on Include without projection
**Where:** `Infrastructure/Persistence/SpecificationEvaluator.cs`
**Current state:** Specifications support `.Include()` for eager loading. If a Specification includes related entities without `.AsNoTracking()` or projection, materialisation can N+1 when the aggregate graph is traversed.
**Industry standard:** Use projection (`.Select()`) for reads; `.Include()` + `.AsNoTracking()` for aggregates. Avoid materializing the entire graph unless needed.
**Fix:** Audit `SpecificationEvaluator` to ensure every read query applies `.AsNoTracking()` and projects to a DTO/read-model. Split: `ReadSpecification` (projection) vs `WriteSpecification` (tracked aggregate).
**Effort:** S

### P1-7 · No request-timeout on inbound API requests
**Where:** `Infrastructure/Resilience/ResiliencePipelineSetup.cs:34` (30s outbound timeout) — but no INBOUND timeout
**Current state:** Outbound HttpClient has 30s timeout. Inbound API requests have no explicit timeout. A slow query or handler can block the HTTP connection indefinitely, exhausting the thread pool on scale-out.
**Industry standard:** ASP.NET Core's `RequestTimeoutPolicy` (.NET 8+) should set a global default (~30–60 s).
**Fix:** Add to `ServiceCollectionExtensions.cs`:
```csharp
services.AddRequestTimeouts(options =>
{
    options.DefaultPolicy = new RequestTimeoutPolicy { Timeout = TimeSpan.FromSeconds(30) };
});
```
Apply via `app.UseRequestTimeouts()` in middleware. Document per-endpoint overrides for long-running operations.
**Effort:** S

### P1-8 · Endpoint idempotency is opt-in per endpoint (easy to forget on mutations)
**Where:** Endpoint files declare `.AddEndpointFilter<IdempotencyEndpointFilter>()` manually
**Current state:** Mutations don't automatically require the idempotency filter. Developer mistake = non-idempotent endpoint despite the command implementing `IIdempotent`.
**Industry standard:** Either enforce at registration time (route-group default) or via Roslyn analyzer.
**Fix:** Set the idempotency filter as a default at the API route-group level: `apiGroup.AddEndpointFilter<IdempotencyEndpointFilter>()`. Plus a Roslyn analyzer that flags any command implementing `IIdempotent` registered without the filter. Plus document in CONTRIBUTING.md.
**Effort:** S

### P1-9 · Handler tests rely on full repository interface mocks (testability friction)
**Where:** `Application/Features/.../Commands/*.cs` — handlers depend on specific `I*Repository` interfaces
**Current state:** Handlers depend on aggregate-specific repos (correct for DDD). But test doubles must implement the full interface — large repos make testing tedious.
**Industry standard:** Test handlers via stub repositories that implement defaults for all methods.
**Fix:** Build a `tests/TestUtilities/` project with `Fake<TRepository>` implementations using a record-and-replay pattern. Document in CONTRIBUTING.md.
**Effort:** S

---

## 3 · P2 findings — architectural quality

### P2-1 · Domain inadvertently couples to multi-tenancy (resolved by Phase 1)
**Where:** `Domain/Entities/BaseEntity.cs` → `Domain/Entities/TenantAuditableEntity.cs` → `Domain/Aggregates/AggregateRoot.cs:17`
**Current state:** `AggregateRoot` extends `TenantAuditableEntity` (carries `TenantId`). Single-tenant domains are forced to carry the field.
**Fix:** **Resolved by the Phase-1 single-tenant strip.** `AggregateRoot` will extend `AuditableEntity` going forward.
**Effort:** S (already in Phase 1 plan)

### P2-2 · Caching invalidation is manual + per-handler (error-prone)
**Where:** `Application/Behaviors/CacheInvalidationBehavior.cs` + handlers implementing `ICacheInvalidating`
**Current state:** Handlers manually declare cache keys to invalidate. New mutations may forget the matching invalidation declaration → stale cache.
**Industry standard:** Region-based invalidation. Tag queries with a region; mutations declare regions; behavior wipes all keys with that region prefix.
**Fix:**
1. Rename `ICacheInvalidating` → `ICacheRegionInvalidating`
2. Method returns `IEnumerable<string> InvalidateRegions()` instead of explicit keys
3. `CacheInvalidationBehavior` deletes all keys matching `ep:<region>:*`
4. Wiki doc: "Mutation X invalidates region Y"
**Effort:** M

### P2-3 · `IIdempotencyStore` mockability not documented
**Where:** `Infrastructure/DependencyInjection.cs:107-112`
**Current state:** DI swaps Redis vs In-Memory based on `CacheSettings.Provider`. Tests cannot easily inject test doubles.
**Industry standard:** Public interface, both implementations public, documented test-double pattern.
**Fix:** Verify `IIdempotencyStore` is public, both implementations public. Add CONTRIBUTING.md section on test doubles. No code change if interfaces are already exposed.
**Effort:** S

### P2-4 · Feature-flag service is configuration-only (no runtime toggle)
**Where:** `Infrastructure/FeatureFlags/FeatureFlagService.cs`
**Current state:** Read-only from `appsettings.json`. No runtime toggle, no admin UI. Cannot flip features without redeploy.
**Industry standard:** LaunchDarkly, Azure App Configuration with feature flags, or bespoke admin panel.
**Fix:** Defer. `IFeatureFlagService` abstraction exists; current implementation is fine for now. Document upgrade path: "Phase 11 — runtime feature flags (Azure App Config or LaunchDarkly)."
**Effort:** S (decision now), L (implementation later)

### P2-5 · XML docs missing on most public methods (Infrastructure + API)
**Where:** Many public methods in `Infrastructure/` and `API/`
**Current state:** Reduced IDE discoverability + no auto-generated docs.
**Industry standard:** All public methods have `/// <summary>...</summary>`.
**Fix:**
- Set `<GenerateDocumentationFile>true</GenerateDocumentationFile>` in csproj
- Set `<NoWarn>$(NoWarn);1591</NoWarn>` initially (warn-not-error on missing) so the build doesn't break
- Add Roslyn analyzer to flag NEW public members without docs
- Backfill incrementally per sprint
**Effort:** M (initial sweep), S (ongoing per-sprint)

### P2-6 · `IReadDbContext.Set<T>()` returns `IQueryable` (allows misuse)
**Where:** `Domain/Interfaces/IReadDbContext.cs:13`
**Current state:** Bare `IQueryable` allows callers to forget `.AsNoTracking()` or re-track entities.
**Industry standard:** Either default `.AsNoTracking()` at DbContext level for read interface, or document the contract clearly.
**Fix:** Either (a) override `Set<T>()` in the read interface to return an already-`AsNoTracking()` queryable, or (b) add a Roslyn analyzer flagging `IReadDbContext.Set<T>()` not followed by `.AsNoTracking()`.
**Effort:** S

### P2-7 · CORS allows all headers from `AllowedHeaders` config (too permissive when config is `["*"]`)
**Where:** `API/Extensions/ServiceCollectionExtensions.cs:69`
**Current state:** `.WithHeaders([.. corsSettings.AllowedHeaders])` blindly applies whatever config says. If config is `["*"]`, all headers allowed.
**Industry standard:** Whitelist specific headers: `Accept, Content-Type, Authorization, X-Correlation-ID, X-Idempotency-Key, X-XSRF-TOKEN`.
**Fix:**
- Add `CorsSettingsValidator` rejecting `"*"` in `AllowedHeaders` at startup
- Update `appsettings.json` to enumerate explicit headers
- Document in `Docs/Security/csp-policy.md`
**Effort:** S

### P2-8 · No per-handler logging context enrichment (`LoggingBehavior` uses generic format)
**Where:** `Application/Behaviors/LoggingBehavior.cs`
**Current state:** Logs handler entry/exit with elapsed time. No aggregate-specific context (e.g., "Role Create: 5ms" gives no tenant/aggregate identity).
**Industry standard:** `LogContext.PushProperty()` to enrich. Handler-specific markers add context.
**Fix:** Behavior pushes generic context (correlation, request type). Handlers can declare `[LogProperty("AggregateId")]` on a property of the request to enrich logs.
**Effort:** S

---

## 4 · P3 findings — polish / future

### P3-1 · `LoggerMessage` (source-generated logging) not used
**Where:** `Application/Behaviors/LogMessages.cs` + log calls in `LoggingBehavior`, `AuditBehavior`
**Current state:** Dynamic-string interpolation (`logger.Information("foo {bar}", bar)`) — works fine but allocates per call.
**Fix:** Add `[LoggerMessage(EventId = N, Level = ..., Message = "...")]` attribute + partial method stubs. Source generator emits zero-allocation IL. Migrate the hot-path logs first.
**Effort:** S per log site; M for full conversion.

### P3-2 · `sealed` not consistently applied to concrete classes
**Where:** Across the solution
**Current state:** Some classes are `public` without `sealed`. Risks accidental subclassing.
**Fix:** Roslyn analyzer (CA1852) flags missing `sealed` on classes that aren't designed for inheritance. Add to `Directory.Build.props` `<NoWarn>` removal, fix incrementally.
**Effort:** S

### P3-3 · `ConfigureAwait(false)` not consistently applied in library code
**Where:** Spot-check across `Application/` and `Infrastructure/`
**Current state:** Most async methods correctly use `.ConfigureAwait(false)` but consistency is not enforced.
**Industry standard:** All library async methods use `.ConfigureAwait(false)`. ASP.NET Core has no `SyncContext` so this is optimization-only, but it's good practice for code that might be consumed elsewhere.
**Fix:** Roslyn analyzer (CA2007) flags missing `ConfigureAwait`. Enable, fix.
**Effort:** S

### P3-4 · No health check for OpenTelemetry exporter
**Where:** `API/Configuration/HealthCheckSetup.cs:20-24`
**Current state:** DB health check exists; OTLP collector / Seq health check does not. If the observability pipeline is down, telemetry is lost silently.
**Fix:** Add `OpenTelemetryHealthCheck` that pings `settings.OtelEndpoint`. Tag as "observability" (optional, not required for readiness).
**Effort:** S

### P3-5 · `ProblemDetailsExtended` mixes RFC 7807 with app-specific fields
**Where:** `Contracts/.../Responses/ProblemDetailsExtended.cs`
**Current state:** Standard RFC 7807 fields (`Type`, `Title`, `Status`, `Detail`, `Instance`) + app extensions (`CorrelationId`, `TenantId`, `FieldErrors`).
**Industry standard:** RFC 7807 ALLOWS extensions; this is correct usage. Document in OpenAPI that extensions are `x-*` (custom) so consumers know what's spec vs ours.
**Fix:** Update OpenAPI schema metadata. No code change.
**Effort:** S

### P3-6 · Audit-mask attribute doesn't recurse into nested objects
**Where:** `Application/Behaviors/AuditBehavior.cs:123-132`
**Current state:** Only top-level string properties are masked. Nested PII (`command.Address.Street`) is not redacted.
**Fix:** Add `AuditSensitiveAttribute` for nested objects; recursively apply masking in `SerializeSnapshot`. Or document: "Mask only at top level; for nested PII, use `AuditIgnore` on the parent property."
**Effort:** S

---

## 5 · What's already good (callouts to preserve)

These patterns are exemplary and should NOT be regressed during Phase 2 work.

| # | Pattern | Where |
|---|---|---|
| 1 | **Clean Architecture discipline** — Domain pure, Application handler-centric, Infrastructure pluggable. Strict dependency flow. | Across the solution |
| 2 | **MediatR pipeline behaviors** — Validation, Audit, Cache, Idempotency, Tracing, Transaction — orthogonal, ordered, documented. | `Application/Behaviors/` |
| 3 | **Security posture** — HTTPS-only (prod), CSP + HSTS, CORS allowlist, bearer auth (Entra B2B + B2C), claim-to-tenant (now removed), rate limiting | `API/Middleware/`, `API/Configuration/` |
| 4 | **Observability** — Serilog structured logging, per-request correlation IDs, OpenTelemetry tracing + metrics, configurable sampling, Seq integration, RFC 7807 problem details | `Infrastructure/Observability/` |
| 5 | **Resilience-first** — Polly retry + timeout for outbound HTTP, idempotency window for commands, RowVersion concurrency, soft-delete (non-destructive) | `Infrastructure/Resilience/` |
| 6 | **Code quality signals** — File-scoped namespaces, sealed classes (most), nullability annotations, ConfigureAwait(false) (most), strict folder boundaries | Solution-wide |
| 7 | **Repository pattern soundness** — `IGenericRepository<T>` for code-first aggregates, per-aggregate repos for specific tables, returns DTOs (never tracked entities) | `Infrastructure/Persistence/` |
| 8 | **Health checks** — Liveness + readiness + per-dependency probes; database health check with timeout | `API/Configuration/HealthCheckSetup.cs` |
| 9 | **Configuration validation** — Strongly-typed options, `ValidateOnStart` enforces correctness at host build (fail-fast), no magic strings | `Infrastructure/Configuration/Validation/` |
| 10 | **Specification pattern** — `ISpecification<T>` with built-in projection + criteria + paging support, `SpecificationEvaluator` applies filters cleanly | `Domain/Specifications/`, `Infrastructure/Persistence/` |

---

## 6 · Suggested phasing (post-Phase-1)

### Phase 2A — Critical path (2 weeks)
- **P0-1**: Correlation propagation to async event handlers
- **P0-2**: Repository / UoW pattern enforcement (analyzer + CONTRIBUTING.md)
- **P1-2**: EF Core retry policy
- **P1-7**: Inbound request timeout
- **P1-8**: Idempotency-default at endpoint group

### Phase 2B — Pipeline + validation hardening (2 weeks)
- **P1-1**: Binding-validation filter + ProblemDetails for binding errors
- **P1-3**: Domain event dispatch timeout + observability
- **P1-6**: SpecificationEvaluator audit (AsNoTracking, projection)

### Phase 2C — Cache + DI polish (1 week)
- **P2-2**: Region-based cache invalidation
- **P2-3**: IIdempotencyStore mockability docs
- **P2-7**: CORS header allowlist enforcement

### Phase 2D — Documentation + analyzers (ongoing)
- **P2-5**: XML docs sweep
- **P3-2**: `sealed` analyzer (CA1852)
- **P3-3**: `ConfigureAwait` analyzer (CA2007)
- **P3-1**: `LoggerMessage` migration on hot paths

### Phase 2E — Future / nice-to-have (deferred)
- **P1-5**: Distributed rate limiting (when scaling out)
- **P2-4**: Runtime feature flags (Azure App Config or LaunchDarkly)
- **P3-4**: OTel exporter health check
- **P3-5**: OpenAPI extension metadata
- **P3-6**: Recursive audit masking

---

## 7 · How findings drive Phase 1

Some Phase-2 findings are partially addressed by the Phase-1 migration plan:

| Phase-2 finding | Phase-1 effect |
|---|---|
| P1-2 (EF retry) | New `AddAppDb` extension is the natural home — incorporate now during the rename |
| P1-4 (concurrency token consistency) | Resolved by code-first `BaseEntity` inheritance going forward |
| P2-1 (domain coupled to tenancy) | Resolved — `AggregateRoot` extends `AuditableEntity` instead of `TenantAuditableEntity` |
| P2-2 (manual cache invalidation) | No effect — patterns persist |

For the EF retry finding (P1-2): I'll incorporate `EnableRetryOnFailure` into the new `AddAppDb` registration during Phase 1 commit 4. **Confirm if you want this folded into Phase 1 or kept as a separate Phase-2 PR.**

---

## 8 · Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-25 | Claude (Opus 4.7) | Initial brutal audit. 25 findings across P0-P3 + 10 callouts of patterns to preserve. Synthesised from parallel agent review of `src/API`, `src/Core`, `src/Infrastructure`, `src/Contracts`. |
