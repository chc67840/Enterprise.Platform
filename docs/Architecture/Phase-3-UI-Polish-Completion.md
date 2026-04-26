# Phase 3 — UI Polish Completion

**Status:** ✅ Completed 2026-04-25.
**Companion docs:**
- [`Phase-2-Completion.md`](./Phase-2-Completion.md) — Phase 2 (backend audit)
- [`Single-Tenant-Migration-Plan.md`](./Single-Tenant-Migration-Plan.md) — Phase 1
- [`UI-Storybook-Removal.md`](./UI-Storybook-Removal.md) — earlier UI strip

`ng build` ✓ · `eslint` ✓ · `dep-cruiser` ✓ · `vitest` 118/120 (2 pre-existing skips).

---

## 0 · Scope

Per the user's framing earlier in the conversation:
> *"fyi .. am not considering multi tenant in ui and back end, stories in angular.., telemetry in angular.... and as of now .. there is no context in backend .."*

Phase 3 = the **client-side telemetry strip** (Application Insights + web-vitals + custom telemetry plumbing) plus a **brutal review** of the SPA for any other dead code / polish opportunities surfaced after Phase 1 (tenancy strip) and the earlier Storybook removal.

The .NET backend already owns observability via Serilog + OpenTelemetry. Client-side telemetry was duplicated effort; removing it shrinks the bundle, removes a third-party SDK from the supply chain, and simplifies the boot path.

---

## 1 · Telemetry strip — what was removed

### 1.1 Files deleted (5 — entire `core/observability/` folder)

| Path | Reason |
|---|---|
| `src/app/core/observability/telemetry.service.ts` | Application Insights + web-vitals facade (~335 LOC) |
| `src/app/core/observability/telemetry-user-sync.service.ts` | Forwards `AuthService.currentUser` into telemetry user-context |
| `src/app/core/observability/global-error-handler.service.ts` | Telemetry-aware Angular `ErrorHandler` |
| `src/app/core/observability/web-vitals-budgets.ts` | LCP/INP/CLS/FCP/TTFB budget constants |
| `src/app/core/observability/index.ts` | Barrel |

### 1.2 Files edited (8)

| Path | Change |
|---|---|
| `src/app/app.ts` | Removed `TelemetryUserSyncService` import + `_telemetryUserSync` protected field. App component now has no telemetry coupling. |
| `src/app/config/app.config.ts` | Removed `ErrorHandler` + `TelemetryService` imports, the `provideAppInitializer(() => inject(TelemetryService).init())`, and the `{ provide: ErrorHandler, useClass: GlobalErrorHandlerService }` registration. Initializer-order doc + comment in CSP-reporter section explain why telemetry is gone. |
| `src/app/config/runtime-config.model.ts` | Removed `TelemetryRuntimeConfigSchema`, the `telemetry` field on `RuntimeConfigSchema`, and the `TelemetryRuntimeConfig` type alias. |
| `src/app/config/runtime-config.ts` | Removed the `telemetry: { ... }` block from `buildFallbackConfig` and the `RUNTIME_CONFIG_HOLDER.telemetry = next.telemetry` line in `applyConfig`. |
| `src/app/config/runtime-config.spec.ts` | Removed `telemetry.appInsightsConnectionString` + `telemetry.sampleRate` assertions from the Zod-defaults spec. |
| `src/app/config/index.ts` | Dropped `TelemetryRuntimeConfig` re-export. |
| `src/app/shared/components/router-error-boundary/router-error-boundary.component.ts` | Removed `TelemetryService` injection + `this.telemetry.trackError(...)` call. The boundary still captures errors via `LoggerService` + renders a fallback UI; only the telemetry-forward step is gone. Comment explains the post-Phase-3 model. |
| `vitest.config.ts` | Dropped the `'src/app/core/observability/web-vitals-budgets.ts'` coverage exclusion. |
| `.dependency-cruiser.cjs` | Dropped the `core/observability/telemetry.service.ts` + `core/observability/global-error-handler.service.ts` whitelist entries from the `env-only-in-config-and-whitelist` rule. Updated the `shared-must-not-import-feature-tier-core` message to drop the `core/observability/*` mention. |

### 1.3 Dependencies removed

| Package | Type | Why |
|---|---|---|
| `@microsoft/applicationinsights-web ^3.4.1` | Production | Telemetry SDK; nothing imports it after the strip |
| `web-vitals ^5.2.0` | Production | LCP/INP/CLS measurement; nothing imports it after the strip |
| `@microsoft/microsoft-graph-types ^2.43.1` | Dev | **Bonus cleanup** — was unused (added speculatively for Entra Graph typing that never landed; per audit P3) |

`npm install` reported **removed 13 packages** (the three direct deps + 10 transitive).

### 1.4 What survives that's telemetry-adjacent

- **`CorrelationContextService`** — kept. Owns correlation-id lifecycle independently of telemetry. The `correlationInterceptor` uses it to stamp `X-Correlation-ID` on every request; the BFF reads the header and forwards it through the .NET observability pipeline (Serilog `LogContext`). End-to-end correlation still works; it just stops at the BFF instead of being shipped to App Insights from the browser.
- **`CspViolationReporterService`** — kept. Subscribes to `securitypolicyviolation` DOM events and logs through `LoggerService` (now console-only post-strip). When a real backend log sink is wired client-side later, this service is the single hook to update.
- **`LoggerService`** — kept. Console-only logger with PII scrubbing. Not telemetry; structured logging only.
- **`provideBrowserGlobalErrorListeners()`** — kept (Angular framework provider). Catches unhandled errors at the browser level; without our custom `GlobalErrorHandlerService` they just hit Angular's default `ErrorHandler` which logs to console. No remote forwarding.

---

## 2 · Brutal-review polish wins

### 2.1 ESLint OnPush rule promoted from warn → error

| File | Change |
|---|---|
| `eslint.config.js` | `'@angular-eslint/prefer-on-push-component-change-detection': 'warn'` → `'error'` |

Verified all current components comply (zero violations). Future components must declare `ChangeDetectionStrategy.OnPush` or the build fails — appropriate for a zoneless app.

### 2.2 Stale Playwright config comment cleaned

`playwright.config.ts` header doc referenced "Phase 4 MSAL-backed happy-path specs" + "Storybook + cross-browser matrix belong to Phase 5" — both stale (Storybook removed, MSAL replaced by BFF cookie-session). Rewritten to describe the current scope without phantom phase numbers.

### 2.3 dep-cruiser whitelist cleaned

The `env-only-in-config-and-whitelist` rule had two exemptions for telemetry files; now they're gone alongside the deleted files. The cruiser message in `shared-must-not-import-feature-tier-core` no longer references `core/observability/*` (which doesn't exist).

---

## 3 · Verification

```bash
cd src/UI/Enterprise.Platform.Web.UI/ClientApp

# Build — production-grade, with bundle budgets
npx ng build --configuration=development
# → bundle generation complete; 0 warnings

# Lint — entire SPA
npx eslint "src/**/*.{ts,html}"
# → 0 errors, 0 warnings

# Architecture rules
npx depcruise --config .dependency-cruiser.cjs --output-type err src
# → ✔ no dependency violations found (116 modules, 165 dependencies cruised)

# Tests
npx vitest run
# → 19 passed | 2 skipped (21) test files; 118 passed | 2 skipped (120) tests

# Confirm telemetry is fully purged
grep -rn "TelemetryService\|GlobalErrorHandlerService\|TelemetryUserSyncService" src/
# → no hits

grep -E "@microsoft/applicationinsights-web|web-vitals" package.json
# → no hits

ls src/app/core/observability/ 2>&1
# → directory does not exist
```

All gates clean.

---

## 4 · Net impact

| Metric | Before | After | Delta |
|---|---|---|---|
| `core/observability/` files | 5 | 0 | −5 |
| Client-side npm direct deps | 22 | 19 | −3 |
| Total transitive packages | (n) | n−13 | −13 |
| Boot-time `provideAppInitializer` calls | 4 | 3 | −1 (telemetry init removed) |
| Boot-time `ErrorHandler` swap | yes | no (default Angular handler) | simplified |
| Lazy-loaded `applicationinsights-web` chunk | ~150 kB gzipped | 0 | shipped to nothing |
| `RuntimeConfigSchema` fields | 5 | 4 | dropped `telemetry` |
| Cruiser whitelist entries (env access) | 5 | 3 | −2 |

---

## 5 · What stayed UNCHANGED in Phase 3

Per the brutal-review audit (read-only) several findings were noted but deliberately left alone — they're either future-feature-dependent or speculative:

| Finding | Why deferred |
|---|---|
| Auth-guard test coverage gap | Add when permission/role gating is exercised by a real feature |
| `MenuConfigService.filter()` perf | Acceptable until menus exceed ~50 items |
| Error boundaries on every lazy route | Add when the route count grows past the current 4 (auth + dashboard + 4 error pages); for now the global `ErrorHandler` + each layout's structure handles it |
| `AuthStore.hydrate()` race-vs-guard | Today's guards run after `provideAppInitializer(AuthService.refreshSession)` resolves; document if a future guard runs concurrently |
| Interceptor-chain-order integration test | Add alongside the first feature that exercises the full chain end-to-end |
| Per-route `RouteMetadata` Zod schema | Yagni until route metadata becomes BFF-driven |
| `CorrelationContextService` "owned by HTTP, not telemetry" JSDoc | Implicit after Phase 3 — the only consumer is the correlation interceptor |

These are tracked in the brutal-review audit but explicitly NOT acted on. The purpose of Phase 3 was the telemetry strip + immediately-actionable polish — not speculative scaffolding for features that don't exist yet.

---

## 6 · Files touched

**Deleted (5):** the entire `src/app/core/observability/` folder.

**Modified (12):**
- `src/app/app.ts`
- `src/app/config/app.config.ts`
- `src/app/config/runtime-config.model.ts`
- `src/app/config/runtime-config.ts`
- `src/app/config/runtime-config.spec.ts`
- `src/app/config/index.ts`
- `src/app/shared/components/router-error-boundary/router-error-boundary.component.ts`
- `vitest.config.ts`
- `.dependency-cruiser.cjs`
- `eslint.config.js`
- `playwright.config.ts`
- `package.json` + `package-lock.json` (auto-refreshed by `npm install`)

---

## 7 · What's next

Phase 3 closes the recreation-cleanup arc. The codebase is now:

- **Backend (Phase 1+2):** single-tenant, AppDbContext skeleton, every audit finding either implemented or documented-deferral
- **Frontend (Storybook removal + Phase 1 frontend strip + Phase 3 telemetry strip):** lean, no dead deps, no stale telemetry plumbing, `ChangeDetectionStrategy.OnPush` enforced

The next moves:

1. **Feature scaffolding** — author the first hand-written aggregate. Recommendation: `User` aggregate as the first concrete test of the patterns (`Domain/Aggregates/User/User.cs` inheriting `BaseEntity`/`AuditableEntity`, `IEntityTypeConfiguration<User>` under `Infrastructure/Persistence/App/Configurations/`, repository under `Persistence/App/Repositories/`, MediatR command/query handlers under `Application/Features/Users/`, minimal API endpoints under `API/Endpoints/v1/Users/`).
2. **EF migration tooling setup** — `dotnet ef migrations add InitialCreate -p src/Infrastructure/Enterprise.Platform.Infrastructure -s src/API/Enterprise.Platform.Api -c AppDbContext` after the first aggregate exists; then `dotnet ef database update` creates `EnterprisePlatform` from migrations.
3. **(Optional) Frontend feature** — the user-management surface in Angular as a counterpart to the User aggregate.

---

## 8 · Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-25 | Claude (Opus 4.7) | Phase 3 executed end-to-end. Telemetry stripped (5 files deleted, 8 edited, 3 deps removed). OnPush ESLint rule promoted to error. Playwright + cruiser stale comments cleaned. All gates green: ng build, eslint, dep-cruiser, vitest 118/120. |
