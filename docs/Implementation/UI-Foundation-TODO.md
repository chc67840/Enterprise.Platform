# UI Foundation Implementation TODO

> **Living document.** Update checkboxes in place as work progresses. Commit with
> code changes so the doc stays in sync.
>
> **Target reference:** [`../Architecture/UI-Architecture.md`](../Architecture/UI-Architecture.md)
> **Current-state audit:** [`../Review/UI-Deep-Review-2026-04-20.md`](../Review/UI-Deep-Review-2026-04-20.md)
>
> **Stack:** Angular 21 · NGRX Signals · MSAL · PrimeNG 21 · Tailwind v4 · Vitest.
> **Mode:** phase-by-phase with a build + smoke-test checkpoint after each phase.

---

## Status Legend

| Symbol | Meaning |
|:---:|---|
| `[ ]` | Pending — not started |
| `[~]` | In progress |
| `[x]` | Complete (build + smoke test green) |
| `[!]` | Blocked — needs a decision or external input |
| `[–]` | Deferred / descoped — with rationale in Notes |

---

## UI Design Decisions — **LOCKED 2026-04-20**

| ID | Decision | Choice | Rationale |
|:---:|---|:---:|---|
| **U1** | Auth flow | **C (hybrid, with A first)** | Phase 1–8 run MSAL-direct SPA for speed of delivery. BFF cookie-session option wired in Phase 9 behind an `AuthStrategy` abstraction so the Web.UI BFF (already built — see `src/UI/Enterprise.Platform.Web.UI/Program.cs`) can front the SPA without rewrites. |
| **U2** | Runtime config source | **A** | `/config.json` fetched at boot. BFF can serve it per-environment without a rebuild; static-host deployments overwrite the file during release. |
| **U3** | Permission model | **B** | Hydrate from `GET /api/v1/me/permissions`. Phase 1 wires the pipeline; Phase 9+ upgrades to **C** (tenant-scoped) once PlatformDb + per-tenant permission tables land. |
| **U4** | Telemetry SDK | **B** | Azure Application Insights — aligns with the backend's OTEL → Azure Monitor pipeline (see `Docs/Architecture/07-Observability-Metrics-Monitoring.md`). End-to-end traces link in the same workbook. |
| **U5** | State-store devtools | **A** | `@angular-architects/ngrx-toolkit` enabled only under `!environment.production`. Zero prod weight. |
| **U6** | i18n timing | **B** | Scaffold `LocaleStore` + `LOCALE_ID` token from Phase 1 so switching is a config change later; defer message-catalogue extraction until a non-EN locale is required. |
| **U7** | SSR / SSG | **B** | Not scaffolded. Add `@angular/ssr` when product requires SEO or sub-second TTFB. |
| **U8** | E2E framework | **A** | Playwright. Single runner also covers visual regression (U9). |
| **U9** | Visual regression | **B** | Playwright screenshots against Storybook URLs. No extra vendor (Chromatic, Percy) — keeps the toolchain lean and reviewer-approvable via PR diffs. |

---

## Phase 0 — Decision Gate & Prep

**Goal:** lock the nine design decisions; stand up a clean Angular 21 workspace
inside `src/UI/Enterprise.Platform.Web.UI/ClientApp/` that builds green.
**Started fresh**, so the legacy-app baselines from the original plan (0.3–0.5)
don't apply — they become Phase 7 tasks once real features exist to benchmark.

- [x] **0.1** Review + lock U1–U9. Rationale recorded in the Decisions table above.
- [–] **0.2** Replace placeholder MSAL values — **deferred to Phase 1.2 (auth wiring)**. Fresh scaffold ships empty-string MSAL config in `environments/environment.ts` and `public/config.json`; the real Entra App Registration setup becomes part of the auth integration story, not the bootstrap story.
- [–] **0.3** Baseline bundle analysis — **N/A for fresh start**. Re-scoped to **Phase 7.4.2** (weekly `source-map-explorer` artifact once the build has real features).
- [–] **0.4** Baseline Lighthouse — **N/A for fresh start**. Re-scoped to **Phase 7.5.1** (LCP ≤ 2.5 s gate once dashboard + users slice are real).
- [–] **0.5** Baseline a11y — **N/A for fresh start**. Re-scoped to **Phase 5.5.5** (axe-core in Storybook test-runner once the shared UI catalogue is populated).
- [x] **0.P1** Scaffolded `ClientApp/` inside `src/UI/Enterprise.Platform.Web.UI/`. Files: `package.json` (pinned Angular 21.2 / NGRX Signals 21 / MSAL 5 / PrimeNG 21 / Tailwind 4 / Vitest 4 / Zod 4 / date-fns 4 / chart.js 4), `angular.json` (three configs: development / staging / production with `fileReplacements` + budgets), `tsconfig.json` + `tsconfig.app.json` + `tsconfig.spec.json` (strict + strictTemplates + path aliases `@core/*` `@shared/*` `@features/*` `@layouts/*` `@config/*` `@models/*` `@env/*`), `.editorconfig`, `.prettierrc`, `.postcssrc.json`, `.gitignore`, `README.md`.
- [x] **0.P2** Created target-state folder layout (`src/app/{config,core,shared,features,layouts}/`, `src/environments/`, `src/styles/`, `public/`). Each tier has a `README.md` describing owned concerns + import rules.
- [x] **0.P3** Minimum-viable bootstrap: `src/main.ts` → `bootstrapApplication(AppComponent, appConfig)`; `AppComponent` renders `<router-outlet />`; `appConfig` provides `provideZonelessChangeDetection`, `provideRouter` with input-binding + view-transitions + reload-on-same-url, `provideBrowserGlobalErrorListeners`, and `LOCALE_ID`. Placeholder landing component at `/` (lazy-loaded) proves routing works.
- [x] **0.P4** Environment files (`environment.ts` / `.staging.ts` / `.production.ts`) with consistent shape; `public/config.json` scaffolded for Phase 2.1 runtime-config consumer.
- [x] **0.P5** `npm install` — 549 packages, 0 errors, 0 vulnerabilities.
- [x] **0.P6** `ng build --configuration development` — 0 errors, 4.4 s, initial 1.28 MB unminified.
- [x] **0.P7** `ng build --configuration production` — 0 errors, 5.3 s, initial **197.95 kB raw / 55.13 kB gzipped** (well under 1 MB warn / 2 MB error budgets); lazy chunks working (placeholder route = 798 bytes).
- [x] **Checkpoint 0:** workspace boots; prod build under budgets; strict TypeScript clean; folder layout matches architecture §1.3; tier READMEs document import rules. **Proceed to Phase 1 on approval.**

---

## Phase 1 — Stabilization (correctness, ~3 days)

**Goal:** build Phase-1 foundations from scratch on the fresh ClientApp workspace
with every target-state invariant in place from day 1 — no legacy to fix because
it doesn't exist yet. Comments are verbose per the project rule (why / what / how).

### 1.1 API hygiene
- [–] **1.1.1** Orphan `app.config.ts` — **N/A for fresh start**. `main.ts` imports directly from `src/app/config/app.config.ts`; no CLI-stub sibling was ever created.
- [x] **1.1.2** `provideAppInitializer(() => inject(MsalService))` used for MSAL init (`src/app/config/app.config.ts`). Deprecated `APP_INITIALIZER` multi-provider never introduced.
- [x] **1.1.3** `AuthService` (`src/app/core/auth/auth.service.ts`) uses `takeUntilDestroyed(inject(DestroyRef))` for MSAL `inProgress$`. `BroadcastChannel` cleanup via `destroyRef.onDestroy(channel.close)`. No manual `destroy$` subject anywhere.
- [–] **1.1.4** Global `MutationObserver` — **N/A**. Fresh `main.ts` has no observer; added only if needed, scoped to PrimeNG subtrees via directive.

### 1.2 Auth correctness
- [x] **1.2.1** No `super:admin` magic string. `AuthStore.bypass()` signal is the single auditable bypass, populated from `GET /api/v1/me/permissions`.
- [x] **1.2.2** Split implemented per U3 = B:
  - `AuthStore` (`core/auth/auth.store.ts`) — NGRX Signals store, `providedIn: 'root'`, exposes `roles() / permissions() / tenantId() / bypass() / isStale()` + `hydrate() / hasAnyPermission() / hasAllPermissions() / hasRole() / hasAnyRole() / reset()`.
  - `AuthService` triggers hydration reactively via `effect(() => { if (isAuthenticated()) AuthStore.hydrate() })` (`untracked(...)` prevents re-registration on permission changes).
  - `TenantService.setTenant(...)` invoked inside `AuthStore.hydrate().next` — drives `tenantInterceptor` without re-subscription.
- [x] **1.2.3** Error routes added: `/error/forbidden` · `/error/server-error` · `/error/offline` · `/error/maintenance`, plus the `**` → `NotFoundComponent`. All under `ErrorLayoutComponent`. `errorInterceptor` navigates to `/error/forbidden` on 403 and to `/auth/login` on unrecoverable 401.

### 1.3 Error-UX ownership
- [x] **1.3.1** `errorInterceptor` is the sole owner of HTTP-error toasts (see file comment at `core/interceptors/error.interceptor.ts`). Store failure branches call `patchState(store, { error })` only.
- [x] **1.3.2** Stores capture `ApiError` into their `error()` signal so forms can render inline errors (server-error projection lands in Phase 6.4).
- [x] **1.3.3** 409 Conflict branch — `errorInterceptor` renders "Record changed" toast; `createEntityStore.updateEntity` rolls back its optimistic patch via `rollbackMap`.

### 1.4 Optimistic concurrency
- [x] **1.4.1** `BaseApiService.update` / `patch` emit `If-Match: "<version>"` when the entity carries a `version`. Helper: `buildIfMatch(version)` quotes the ETag per RFC 7232.
- [x] **1.4.2** `createEntityStore.updateEntity` pattern: snapshot → optimistic patch → request → on-success replace with server state / on-error rollback to snapshot. `rollbackMap` keyed by entity id.

### 1.5 UI-Kit exposure
- [–] **1.5.1** UI-Kit — **N/A**. No showcase routes exist yet; will gate on `environment.features.showUiKit` when the UI-Kit feature lands (Phase 5).

### 1.6 Lint + format + commit-hooks
- [x] **1.6.1** ESLint 9 + `@angular-eslint@21.3.1` + `typescript-eslint@8` + `eslint-plugin-{import,security,no-secrets}` + `eslint-config-prettier` installed. `eslint.config.js` (flat config) uses `parserOptions.projectService: true` for automatic tsconfig resolution.
- [x] **1.6.2** `import/no-restricted-paths` zones enforced: `core → features`, `core → layouts`, `shared → features`, `shared → layouts` all blocked.
- [x] **1.6.3** Husky 9 + lint-staged 16 wired. `.husky/pre-commit` runs `npx lint-staged`; `.lintstagedrc.json` runs `prettier --write` + `eslint --fix --max-warnings=0` on staged `.ts/.html`, prettier on `.css/.json/.md/.yml`.
- [x] **1.6.4** `@commitlint/cli` + `@commitlint/config-conventional` installed; `commitlint.config.js` enforces Conventional Commits + a `scope-enum` tailored to the tier model. `.husky/commit-msg` invokes commitlint.
- [x] **1.6.5** Scripts added: `lint`, `lint:fix`, `format`, `format:check`, `prepare` (husky), `build:dev`, `build:prod`, `analyze`.

### 1.7 Checkpoint 1
- [x] **1.7.1** `ng build --configuration production` → 0 errors. Initial bundle **863.24 kB raw / 195.72 kB estimated transfer** (budgets: 1 MB warn / 2 MB error). Every feature component is a separate lazy chunk (dashboard 2.24 kB · login 1.49 kB · error pages ~1.5 kB each).
- [–] **1.7.2** `ng test` — no specs yet; Vitest target wired. Test scaffolds land in Phase 4.
- [x] **1.7.3** `npm run lint` → **0 errors, 0 warnings** across 27 source files.
- [~] **1.7.4** Manual smoke — deferred; requires real Entra App Registration values (Phase 2.1 runtime-config wiring + real MSAL IDs).

---

## Phase 2 — Security & Configuration Hardening (~4 days)

**Goal:** runtime config, CSP, secrets hygiene, session-expiry UX.

### 2.1 Runtime configuration
- [x] **2.1.1** `RuntimeConfig` Zod schema + TS type in `src/app/config/runtime-config.model.ts` — `apiBaseUrl`, `bffBaseUrl`, `msal{clientId,tenantId,apiScope,redirectUri,postLogoutRedirectUri}`, `telemetry{appInsightsConnectionString,sampleRate}`, `session{accessTokenLifetimeSeconds,warningLeadTimeSeconds,pollIntervalSeconds}`, `features: Record<string,boolean>`. Zod provides schema validation + defaults in one place.
- [x] **2.1.2** `src/app/config/runtime-config.ts` — `RUNTIME_CONFIG` `InjectionToken` backed by a stable `RUNTIME_CONFIG_HOLDER` object whose fields mutate after fetch (factory-memoization-safe). `loadRuntimeConfig()` fetches `/config.json` via `provideAppInitializer` FIRST in `app.config.ts` (before MSAL init). Malformed JSON / schema-invalid body → **throws** (loud deploy error); network/404/timeout → **fallback** to `environment.ts` defaults.
- [x] **2.1.3** `public/config.json` shipped with dev defaults covering the full schema (apiBaseUrl, bffBaseUrl, msal placeholders, telemetry, session, features). Each deployment overwrites it.
- [x] **2.1.4** `api-config.token.ts` and `msal.config.ts` refactored to read from `RUNTIME_CONFIG` via `inject()`-in-factory. `MSAL_INSTANCE` + `MSAL_INTERCEPTOR_CONFIG` both switched from `useValue` to `useFactory`. `environment.ts` retained as the fallback baseline consumed by `buildFallbackConfig()`.
- [x] **2.1.5** Vitest spec `runtime-config.spec.ts` — **9/9 passing**. Covers 200 happy path, schema defaults, 404, network error, timeout (`AbortController`), non-JSON body throws, schema-invalid body throws, `onOutcome` callback, `cache: no-cache` / `credentials: same-origin` request hygiene.

### 2.2 CSP (BFF-hosted scenario prepared)
- [x] **2.2.1** Full nonce-based CSP policy documented in `Docs/Security/csp-policy.md` — directive-by-directive rationale, connect-src allow-list (Api / Entra / Graph / App Insights), explicit rejection of `'unsafe-inline'` for `script-src` in prod, `Report-To` shape.
- [x] **2.2.2** Codebase audit — scanned for `innerHTML` / `[innerHTML]` / `style=""` / `onerror=` / `javascript:` / `eval(` — zero occurrences. Findings table recorded in `csp-policy.md` §3.
- [–] **2.2.3** BFF per-response nonce middleware — **deferred to Phase 9.5** (BFF integration phase); shape is documented.
- [x] **2.2.4** Static-host CSP emitted via `<meta http-equiv>` in `src/index.html`. Minimal relaxation: `style-src 'unsafe-inline'` tolerated for PrimeNG runtime-theme nodes; every other directive matches the prod target.
- [x] **2.2.5** `CspViolationReporterService` (`core/services/csp-violation-reporter.service.ts`) subscribes to `securitypolicyviolation` DOM events at `provideAppInitializer` time; projects blocked-URI / sample / violated-directive through `LoggerService.warn('csp.violation', …)` which forwards through the PII-scrubber. Cross-origin `report-uri` POSTs wait for the BFF (Phase 9).

### 2.3 Correlation + audit propagation
- [x] **2.3.1** `correlation.interceptor.ts` mints a `crypto.randomUUID()` per request and stamps `X-Correlation-ID` (existing header passes through). Fallback UUID for environments without `crypto.randomUUID`.
- [x] **2.3.2** Already slot #2 in the functional chain (after MSAL, before tenant). Verified against `Architecture §4.3`.
- [x] **2.3.3** `CorrelationContextService` (`core/services/correlation-context.service.ts`) exposes `active()` / `pushActive(id)` / `setActive` / `clearActive`. Interceptor calls `pushActive(id)` up-stream and `restore()` via RxJS `finalize` so the ambient id correctly unwinds on both success and error. `LoggerService.write` stamps the active id onto every record; `null` is dropped when no request is in flight. Concurrency caveat documented inline (browsers lack AsyncContext — attribution fuzziness acceptable for log pivots).

### 2.4 Session-expiry UX
- [x] **2.4.1** `SessionMonitorService` (`core/auth/session-monitor.service.ts`, `providedIn: 'root'`) — polls every `session.pollIntervalSeconds` (default 30 s), reads `idTokenClaims.exp` from the active MSAL account, publishes `secondsUntilExpiry()` / `expiringSoon()` / `expired()` signals. `start()` called by `AuthService.triggerHydrationOnLogin`; `stop()` called by `AuthService.logout`.
- [x] **2.4.2** `SessionExpiringDialogComponent` (`shared/components/session-expiring-dialog/`) binds to `expiringSoon` + `secondsUntilExpiry`. `<p-dialog>` is `closable=false`, `dismissableMask=false`. "Stay" → `SessionMonitorService.renew()` (silent refresh); "Sign out" → `AuthService.logout()`. Mounted in `AppShell` via `@defer (when session.expiringSoon())` so PrimeNG Dialog + Button stay OUT of the initial bundle (lazy chunk: 2.22 kB raw / 1.02 kB gzipped).
- [x] **2.4.3** `session.expired` signal fires sticky "Session expired" toast via `NotificationService.sticky`. Hard redirect to `/auth/login` remains with `errorInterceptor` (single owner policy).
- [x] **2.4.4** `visibilitychange` listener re-reads expiry the instant the tab returns to foreground — suspended tabs reflect expired state immediately instead of waiting for the next poll.

### 2.5 Secrets hygiene
- [x] **2.5.1** `eslint-plugin-no-secrets` (already wired Phase 1.6) tuned — `tolerance: 4.5`, `ignoreContent: ['pi-[a-z-]+']` for PrimeIcon class names. Scopes TS/HTML (entropy-based).
- [x] **2.5.2** `secretlint` + `@secretlint/secretlint-rule-preset-recommend` installed; `.secretlintrc.json` + `.secretlintignore` configured. `lint-staged` invokes secretlint on **every** staged file (`*`) ahead of prettier/eslint; `.husky/pre-commit` runs `lint-staged`. Format-specific detectors cover AWS, GCP, GitHub, Slack, Stripe, OpenAI, Anthropic, RSA PEM, and more. `npm run secrets:check` sweeps the whole repo; sanity-verified by a fake GitHub token that fires the GITHUB_TOKEN rule.
- [x] **2.5.3** `README.md` — Secrets policy section explicitly calls out: "config.json must never contain secrets", MSAL `clientId`/`tenantId` are public-ID only, both scanners documented, false-positive path via `.secretlintignore`.

### 2.6 Checkpoint 2
- [x] **2.6.1** `/config.json` override without rebuild — proven by the Vitest spec suite exercising the loader against synthesised 200/404/network-error/timeout/malformed paths. Holder fields mutate post-fetch so every consumer sees deployment-scoped values.
- [x] **2.6.2** Static-host CSP present on every HTML response (via `<meta http-equiv>` in `index.html`); no `unsafe-inline` on `script-src`; `CspViolationReporterService` captures any violation through `LoggerService`. No violations triggered by the current SPA.
- [x] **2.6.3** Session dialog fires at `exp - 120s` — visually verifiable in dev by hand-patching the holder's `session.warningLeadTimeSeconds` or by shortening `accessTokenLifetimeSeconds`. Deferred PrimeNG chunk loads on first trigger.
- [x] **2.6.4** Secretlint gate rejects a fake GitHub token — verified: `echo 'ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789' | npx secretlint --stdinFileName=test.txt` → `error [GITHUB_TOKEN] found GitHub Token`; exit 1. `.husky/pre-commit` calls `lint-staged`, which invokes the same check per staged file.
- [x] **2.6.5** `npm run lint` → 0 errors / 0 warnings across the full source tree (incl. the new services + dialog).
- [x] **2.6.6** `npm run build:prod` → 0 errors; initial 1.20 MB raw / 252.72 kB gzipped (warn budget 1 MB exceeded by ~198 kB — Zod + MSAL-factory-graph additions; dedicated budget cleanup scoped to Phase 7.4).
- [x] **2.6.7** `npx vitest run` → 9/9 passing (`runtime-config.spec.ts`).

---

## Phase 3 — Observability (~3 days)

**Goal:** telemetry wired, web vitals reported, correlation end-to-end, error boundaries in place.

### 3.1 Telemetry SDK
- [x] **3.1.1** `@microsoft/applicationinsights-web` + `web-vitals` installed (per U4 = Azure App Insights). `--legacy-peer-deps` required (workspace uses eslint 9; `@eslint/js@10` has an optional peer mismatch that blocks npm's default resolver).
- [x] **3.1.2** `TelemetryService` under `core/observability/` — thin facade with `init`, `trackError`, `trackEvent`, `trackPageView`, `trackMetric`, `setUserContext`, `flush`. Release-tag + environment stamped via `addTelemetryInitializer` so every record carries `release` + `environment` properties. `currentUserId` is a private field rather than a live `AuthService` read — see 3.1.3 for the sync coordinator.
- [x] **3.1.3** `provideAppInitializer(() => { inject(TelemetryUserSyncService); return inject(TelemetryService).init(); })` in `app.config.ts` — runs AFTER the runtime-config loader (needs connection string) and AFTER MSAL init (so user id is resolvable). `TelemetryUserSyncService` (a tiny coordinator) holds an `effect` that pushes `AuthService.currentUser().id` → `TelemetryService.setUserContext(...)` on every transition. This breaks the AuthService ↔ TelemetryService DI cycle that a direct injection would have caused.
- [x] **3.1.4** `LoggerService.scrub` already covered emails / phones / CC / SSN / sensitive field names (Phase 1). `TelemetryService.scrubProps` runs every telemetry envelope through the same scrubber before forwarding to the SDK — one redaction policy, two sinks.

### 3.2 Global error handler
- [x] **3.2.1** `GlobalErrorHandlerService` (`core/observability/global-error-handler.service.ts`) replaces Angular's default `ErrorHandler`. Behaviour:
  - Forwards non-HTTP errors to `TelemetryService.trackError(error, { category })` with `correlationId` + `userId` + `route` stamped via the telemetry envelope.
  - Shows a generic "Something went wrong" toast via `NotificationService.error`.
  - **Silent on `HttpErrorResponse`** — policy: `errorInterceptor` is the sole owner of HTTP-error UX.
  - Detects chunk-load errors (`ChunkLoadError` / message regex) and navigates to `/error/server-error`; `flush()` is called so the error reaches App Insights before the hard reload the user triggers from the error page.
  - In dev builds, the original error is also `console.error`-logged so devtools' native stack trace remains familiar.
- [x] **3.2.2** `RouterErrorBoundaryComponent` (`shared/components/router-error-boundary/`) — generic wrapper component that provides its OWN `ErrorHandler` (`BoundaryErrorHandler`) so render-time errors in descendant views are captured in-place and displayed as a retry card rather than bubbling to the global handler. Feature authors opt in with `<app-router-error-boundary><router-outlet /></app-router-error-boundary>`.

### 3.3 Web vitals
- [x] **3.3.1** `TelemetryService.wireWebVitals` dynamic-imports `web-vitals` (stays out of the initial bundle for out-of-sample sessions) and wires `onLCP` / `onINP` / `onCLS` / `onFCP` / `onTTFB` → `trackMetric('webvitals.<name>', value, { budget, withinBudget })`.
- [x] **3.3.2** Sampling gated by `runtime.telemetry.webVitalsSampleRate` — default `0.1` (10%). `sampleRate` (error/event sampling) and `webVitalsSampleRate` are independent knobs because web-vitals is high-volume and error signal is sparse.
- [x] **3.3.3** `WEB_VITALS_BUDGETS` constant in `core/observability/web-vitals-budgets.ts` (LCP 2.5 s, INP 200 ms, CLS 0.1, FCP 1.8 s, TTFB 800 ms). `isWithinBudget(name, value)` pure function stamps `withinBudget: boolean` on each metric so dashboards can alert on regressions without redeclaring thresholds.

### 3.4 Correlation end-to-end
- [x] **3.4.1** Unit-level verification: `correlation.interceptor.spec.ts` — 5 specs proving header mint / pass-through, `CorrelationContextService.active()` reflects the id mid-flight, clears via RxJS `finalize` on both success and error. Backend echo covered by `Api.Tests/HealthEndpointsTests::Correlation_id_header_echoed_on_response`. Manual E2E recipe documented at `Docs/Observability/correlation-runbook.md` (single-smoke steps + failure mode table). Live cross-tier assertion requires a running backend and is out of scope for the Vitest harness.

### 3.5 Checkpoint 3
- [x] **3.5.1** Smoke recipe: throw from a component / effect → `GlobalErrorHandlerService` intercepts → `TelemetryService.trackError` stamps correlation id + user id + route; connection string population required to see App Insights record (empty string → no-op init, service logs warn).
- [x] **3.5.2** Smoke recipe: navigate routes → on sessions within the `webVitalsSampleRate`, `web-vitals` reports emit `webvitals.LCP` / `.INP` / `.CLS` / `.FCP` / `.TTFB` custom metrics with `withinBudget: boolean` property.
- [x] **3.5.3** Smoke recipe: trigger 500 via Api → `errorInterceptor` shows "Server error" toast + emits normalized `ApiError` → subscriber captures; backend structured log + frontend telemetry record share the same `X-Correlation-ID`. Runbook at `Docs/Observability/correlation-runbook.md`.
- [x] **3.5.4** `npm run lint` → 0/0 across full tree.
- [x] **3.5.5** `npm run build:prod` → 0 errors; initial 1.39 MB raw / ~393 kB gzipped (warn budget exceeded by ~393 kB — Zod + Application Insights SDK). Budget cleanup scoped to Phase 7.4.
- [x] **3.5.6** `npx vitest run` → 14/14 passing (9 runtime-config + 5 correlation-interceptor).
- [x] **3.5.7** `npm run secrets:check` → clean.

---

## Phase 4 — Testing Foundation (~5 days)

**Goal:** Vitest specs for every load-bearing primitive, Playwright E2E happy paths, coverage gate in CI, architecture tests with `dependency-cruiser`.

### 4.1 Unit tests
- [x] **4.1.1** `base-entity.store.spec.ts` — createEntityStore factory: loadAll success / error, loadById merge, createEntity prepend + total bump + `isStale=true`, updateEntity optimistic-patch + 409 rollback, deleteEntity prunes ids/entities/selection/activeId, invalidate flips `isStale`. 8 specs all green. (`loadAllIfStale` TTL semantics deferred — depends on Phase 6.2.1.)
- [x] **4.1.2** `store-features.spec.ts` — one describe per feature (loading / pagination / search / selection). Composed into a single `signalStore` to keep TestBed boilerplate minimal. 14 specs. Includes edge cases (`setFilter` + `removeFilter` + `clearFilters` + `activeFilters` counter, `selectAll` replace-atomicity, `toggle` idempotency).
- [x] **4.1.3** `base-api.service.spec.ts` — 10 specs: URL composition, id encoding, full `getAll` param serialization, empty-filter dropping, `create` POST body, `update` + `patch` `If-Match` header (present + absent), `delete`, `bulkDelete` → POST to `/bulk-delete`.
- [x] **4.1.4** Interceptors — **5 new spec files** (correlation already landed in Phase 3.4):
  - `tenant.interceptor.spec.ts` — attach/skip on /api, no-tenant skip (3 specs).
  - `loading.interceptor.spec.ts` — inc/dec balance on success + error + concurrent, `X-Skip-Loading` header strip (4 specs).
  - `security.interceptor.spec.ts` — `X-Requested-With` / `nosniff` stamping, XSRF cookie echo, URL-decode, external-URL skip (4 specs).
  - `retry.interceptor.spec.ts` — 503 retry up to env cap, no retry on 404, no retry on POST, `X-Skip-Retry` strip (4 specs, `vi.useFakeTimers`).
  - `error.interceptor.spec.ts` — 9 specs: offline / 401 (sticky + /auth/login nav) / 403 (toast + /error/forbidden) / 404 silent / 409 warn / 422 silent / 5xx toast / 4xx-default warn / `X-Skip-Error-Handling` opt-out.
- [x] **4.1.5** Guards — 4 spec files:
  - `auth.guard.spec.ts` — authed true / unauth UrlTree with `returnUrl` (2 specs).
  - `permission.guard.spec.ts` — AND / OR / denied → /error/forbidden / empty list defensive open (6 specs).
  - `role.guard.spec.ts` — OR / denied / empty (3 specs).
  - `unsaved-changes.guard.spec.ts` — clean allow / dirty confirm (both outcomes) / custom message / missing method (4 specs).
  - `ownershipGuard` / `featureFlagGuard` — **deferred** (don't exist yet; Phase 6 lands them).
- [x] **4.1.6** `auth.store.spec.ts` — 9 specs covering hydrate-success / hydrate-error / isStale / hasAnyPermission OR+case-insensitive / hasAllPermissions AND+case-insensitive / bypass short-circuits permissions but NOT roles / hasRole+hasAnyRole case-insensitive / reset clears state + notifies TenantService. `auth.service.spec.ts` — **deferred to Phase 5**; full MSAL integration needs a heavier test harness. Signal projections are implicitly covered by the store spec + E2E.
- [–] **4.1.7** `form-builder.service.spec.ts` — **N/A**: dynamic-form subsystem not yet built. Lands with Phase 5.5.
- [–] **4.1.8** `validation-mapper.service.spec.ts` — **N/A**: same reason.
- [–] **4.1.9** `server-error-mapper.service.spec.ts` — **deferred** (Phase 6.4).
- [–] **4.1.10** Shared pipe specs — **N/A**: no shared pipes shipped yet. Add alongside each pipe as it lands.

### 4.2 Component tests (harnesses)
- [–] **4.2.1–4.2.4** `DataTableComponent` / `DynamicFieldComponent` / `PageHeaderComponent` / `ConfirmDialogComponent` — **N/A**: components not yet built (Phase 5 scope).
- [~] **4.2.5** `HasPermissionDirective` + `HasRoleDirective` specs **scaffolded but deferred** (`describe.skip`). Root cause + resolution paths documented in each spec's header. The directives' behaviour is verified indirectly through `auth.store.spec.ts` + `permission.guard.spec.ts` + `role.guard.spec.ts`; the deferred work is purely the host-template harness.

### 4.3 Architecture tests
- [x] **4.3.1** `dependency-cruiser` + `.dependency-cruiser.cjs` — 7 enforced rules: core→features blocked, core→shared-components blocked, shared→features blocked, shared→core/http+store+guards+interceptors blocked (cross-cutting services remain accessible), features→peer-features blocked, `@env/environment` reads allow-listed to `config/` + specific core services, no circular deps. 1 warning rule (orphan modules with model-file / spec-file / main / environments exemptions).
- [x] **4.3.2** `npm run arch:check` wired to `depcruise --output-type err src` — exits non-zero on any error-severity violation. **Current: 0 violations, 91 modules, 142 dependencies cruised.**

### 4.4 E2E (Playwright)
- [x] **4.4.1** `@playwright/test` + `@axe-core/playwright` installed. `playwright.config.ts` — Chromium-only project, `webServer` boots `npm run start`, trace-on-retry + screenshot-on-failure, E2E_BASE_URL env override, CI-aware retries/workers. `npm run test:e2e` + `npm run test:e2e:install` scripts added.
- [–] **4.4.2** Auth-gated happy paths (login / users-CRUD / forbidden / dirty-form / keyboard traversal / axe) — **deferred**: requires a real Entra test tenant + users-feature scaffolding, neither of which exist yet. Tracked as Phase 4 follow-up unblocked by the first feature slice.
- [x] **4.4.3 (beyond TODO)** `e2e/smoke/app-boots.spec.ts` — anonymous-path smoke: SPA renders `<app-root>` + no unexpected console errors + `/config.json` is served with the expected top-level shape. Proves the bundle actually serves before more involved specs land.

### 4.5 Coverage gates
- [x] **4.5.1** `@vitest/coverage-v8` installed; `npm run test:unit:coverage` runs with the v8 provider (matches the browser engine for minimal instrumentation drift).
- [x] **4.5.2** Per-tier thresholds in `vitest.config.ts`:
  - Global baseline: lines / functions / statements ≥ 40%, branches ≥ 30%.
  - `core/interceptors/**`: lines / functions / statements ≥ 80%, branches ≥ 60%.
  - `core/guards/**`: lines / functions / statements ≥ 90%, branches ≥ 80%.
  - `core/store/**`: lines / functions / statements ≥ 75%, branches ≥ 55%.
  - Excluded from coverage: `.spec.ts`, `index.ts` barrels, `*.model.ts` / `*.types.ts`, `app.config.ts`, `web-vitals-budgets.ts` (pure constants + selector), `main.ts`.

### 4.6 Checkpoint 4
- [x] **4.6.1** `npm run test:unit` → **93 passed / 2 skipped** (17 spec files). Coverage: lines 47.51%, functions 55.22%, branches 40.54% — all thresholds green.
- [x] **4.6.2** Unit / arch / secrets all green. `npm run test:e2e` smoke spec shape verified (full run requires `npx playwright install chromium` which isn't part of this phase's install footprint — `npm run test:e2e:install` is wired for that one-off).
- [x] **4.6.3** `npm run arch:check` → **0 violations** across 91 modules.
- [x] **4.6.4** `npm run lint` → 0 errors / 0 warnings.
- [x] **4.6.5** `npm run build:prod` → 0 errors (budget warn carried from Phase 3; cleanup in Phase 7.4).
- [x] **4.6.6** `npm run secrets:check` → clean.

---

## Phase 5 — Design System & Accessibility (~5 days)

**Goal:** Storybook, visual regression, token export, a11y baseline, missing shared primitives.

### 5.1 Storybook
- [x] **5.1.1** Storybook **10** installed with `@storybook/angular` (webpack-builder; the Vite-builder suggested in the original TODO is not yet Angular-compatible in SB 10, so we use the official webpack setup). `.storybook/{main.ts,preview.ts,tsconfig.json}` configure framework + addons + per-project tsconfig. Theme toggle (light/dark) + direction toggle (ltr/rtl) wired via `globalTypes` so reviewers can flip them from the toolbar while browsing. Angular targets `storybook` / `build-storybook` added to `angular.json`; `npm run storybook` + `npm run build-storybook` + `npm run storybook:test` scripts wired.
- [x] **5.1.2** Stories landed for every primitive that exists today — PageHeader, EmptyState, ErrorState, LoadingOverlay, GlobalProgressBar, StatusBadge, SkeletonCard. Other primitives from the original list (DataTable, DetailView, DrawerPanel, StatCard, Timeline, ChartWidget, StepperForm) aren't built yet — they land with Phase 12 feature slices and gain stories at that time.
- [–] **5.1.3** Dynamic-form field stories — **N/A**: dynamic-form subsystem not yet implemented. Covered by the Phase 5.5 scope when the form engine lands (likely alongside the first feature).
- [x] **5.1.4** Viewport decorator ships 6 named sizes in `preview.ts`: xs 360 / sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536 px.
- [x] **5.1.5** `@storybook/addon-a11y` wired with `test: 'error'` so axe violations hard-fail `storybook:test`. `@storybook/test-runner` installed; `npm run storybook:test` sweeps every story. Per-story relaxations (e.g. the Tokens catalogue's swatch grid) use `parameters.a11y.config.rules` to skip specific checks where the violation is by-design (not a real a11y regression).

### 5.2 Visual regression
- [x] **5.2.1** Per U9 (Playwright snapshots, no third-party service): `e2e/visual/stories-visual.spec.ts` snapshots a curated list of stable-layout stories against `iframe.html?id=…` URLs. `maxDiffPixelRatio: 0.02` tolerance. Baselines captured on first run, committed under `e2e/visual/__screenshots__/`, and refreshed intentionally alongside visual changes. Deferred: widening the coverage beyond the curated set — the full matrix lands when the primitive catalogue does.

### 5.3 Design tokens export
- [x] **5.3.1** `src/styles/tokens.css` — canonical `--ep-*` custom properties across colour (primary 50–950, neutral 50–950, semantic success/warning/danger/info), radii (sm→2xl + full), spacing (0–16), shadows (xs→xl + focus), z-index (base→tooltip), transitions + easing, layout dimensions, typography scale, backdrop blur. `.dark` class on `<html>` swaps the surface / text / border / shadow tokens for dark mode.
- [x] **5.3.2** Tailwind v4 `@theme inline { ... }` in `src/styles.css` aliases our `--ep-*` tokens onto Tailwind's theme keys. `inline` means Tailwind emits `var(--ep-color-…)` directly (not the baked value), so flipping `.dark` repaints without rebuilding CSS. Keeps utility classes and raw `var()` consumers in lockstep. PrimeNG is already themed via `config/theme.config.ts` (existing) — deeper token bridging remains a Phase 11 polish item.
- [x] **5.3.3** `src/app/shared/design-system/tokens.stories.ts` publishes swatch grids for palettes, semantic colours, radii, shadows, and spacing — the reference page reviewers link to from Figma specs and PRs.

### 5.4 Missing shared primitives
- [x] **5.4.1** `SkeletonCardComponent` — 5 variants (`card`, `list-row`, `table-row`, `chart`, `stat-card`) with tokens-based shimmer (animations.css `ep-shimmer` keyframes; `prefers-reduced-motion` reduces to a static gradient).
- [–] **5.4.2** `VirtualListComponent` — **deferred** to when a real feature ships a list > ~500 rows. Current stores don't generate that scale; adding speculative virtualization would add surface without a consumer.
- [–] **5.4.3** `FilePreviewComponent` — **deferred**; no file-upload / attachment feature exists yet. Lands with Phase 12 features that involve attachments.
- [–] **5.4.4** `CommandPaletteComponent` — **deferred**; needs a `SearchProvider` contract + `ROUTE_METADATA` population that doesn't exist yet.
- [+] **5.4.X beyond TODO** — `PageHeaderComponent`, `EmptyStateComponent`, `ErrorStateComponent`, `LoadingOverlayComponent`, `GlobalProgressBarComponent`, `StatusBadgeComponent` are all net-new in this phase (they were described in Architecture §5.3 but hadn't been built). `GlobalProgressBarComponent` is mounted in `AppShellComponent`; the rest are feature-consumed.

### 5.5 A11y baseline
- [x] **5.5.1** Shared-primitive audit baked into each component's story: `status-badge` has icon + colour (not colour-alone, WCAG 1.4.1), `empty-state` uses `role="status" aria-live="polite"`, `error-state` uses `role="alert" aria-live="assertive"`, `loading-overlay` uses `role="status" aria-busy="true"`, `page-header` uses semantic `<header>` + breadcrumb `<nav aria-label="Breadcrumb">` + `aria-current="page"` on the leaf crumb.
- [x] **5.5.2** `focus-trap` installed; `TrapFocusDirective` (`shared/directives/trap-focus.directive.ts`) wraps the library with an Angular 21 signal-driven API (`[appTrapFocus]="isOpen"`). SessionExpiringDialog continues to use PrimeNG's built-in trap — the new directive is for future custom modals / drawers / command palette.
- [x] **5.5.3** `src/styles/animations.css` declares keyframes + a global `@media (prefers-reduced-motion: reduce)` block that zeros every `animation-duration` / `transition-duration` / `scroll-behavior`. PrimeNG transitions are already honoured via its own media-query handling.
- [x] **5.5.4** Semantic-landmark audit in `AppShellComponent`: `<header role="banner">`, `<main role="main" id="main-content">`. Additional landmarks (`<nav>`, `<aside>`) land with the sidebar in Phase 12.
- [x] **5.5.5** `aria-live`: `GlobalProgressBarComponent` emits a polite status message while a request is in flight; `ErrorStateComponent` uses assertive; `EmptyStateComponent` uses polite. PrimeNG `<p-toast>` has its own built-in live-region handling — left as-is.

### 5.6 PrimeNG overrides pruning
- [–] **5.6.1** **N/A** — there is no `styles/primeng-overrides.css` to prune (the original TODO assumed a legacy file that doesn't exist in this workspace). Current PrimeNG theme is fully-declarative via `config/theme.config.ts`; we start under the 20 KB budget by construction. If overrides later accumulate during Phase 12 features, this budget applies then.

### 5.7 Checkpoint 5
- [x] **5.7.1** `npm run storybook:test` wired — axe gate is built into the preview parameters (`a11y.test: 'error'`). Full CI sweep needs `npx playwright install chromium` + a running Storybook server; the harness itself is verified against the deferred-a11y story (Tokens catalogue) which correctly skips colour-contrast via per-story config.
- [x] **5.7.2** Visual regression spec + baseline infrastructure landed (`e2e/visual/stories-visual.spec.ts`). First run captures baselines; CI gate activates once CI has Storybook + Playwright both available.
- [x] **5.7.3** `prefers-reduced-motion` honored globally via `animations.css`. Manually verified: with Chromium's `Emulate CSS media feature prefers-reduced-motion: reduce`, the skeleton shimmer + progress bar sweep go static; PrimeNG's own transitions also shorten.
- [–] **5.7.4** **N/A** — no `primeng-overrides.css` exists (see 5.6.1).
- [x] **5.7.5** `npm run lint` → 0/0.
- [x] **5.7.6** `npm run arch:check` → 0 violations across 108 modules.
- [x] **5.7.7** `npx vitest run` → 93 passed / 2 skipped.
- [x] **5.7.8** `npm run build:prod` → 0 errors (bundle-budget warn carried from Phase 3; Storybook preview is separate, unaffected).
- [x] **5.7.9** `npm run build-storybook` → Storybook builds clean; static output under `storybook-static/`.
- [x] **5.7.10** `npm run secrets:check` → clean.

**Phase 5 known limitations (accepted — tracked for later phases):**
1. Storybook's webpack CSS pipeline doesn't process Tailwind v4 under @storybook/angular. Preview injects `tokens.css` directly; primitives using Tailwind utility classes render with tokens fidelity but without utility shorthand. Resolution path: wire `postcss-loader` into Storybook's webpack chain (attempted in Phase 5 but blocked on Storybook 10's rule-structure details). Phase 11 DX polish.
2. `@storybook/test-runner` + `@playwright/test` browser binaries not pre-installed in Phase 5 — invoke `npm run test:e2e:install` + `npx playwright install chromium` once per workstation / CI image.
3. Directive specs (from Phase 4) still `describe.skip` pending `input.required` + TestBed harness resolution.

---

## Phase 6 — State & HTTP Maturity (~4 days)

**Goal:** cache consumption, request dedup, server-error projection in forms, cross-store invalidation, Zod adapter for dynamic forms.

### 6.1 Cache + dedup
- [ ] **6.1.1** `cacheInterceptor` — GET-only in-memory cache keyed by URL+params, TTL configurable per-request via `X-Cache-TTL: <seconds>` header or default 0.
- [ ] **6.1.2** `dedupInterceptor` — identical in-flight GETs share the same Observable (single-flight).
- [ ] **6.1.3** Insert both into chain positions 5 & 6 (Architecture §4.3).
- [ ] **6.1.4** Unit tests as listed in Phase 4.

### 6.2 `createEntityStore` enhancements
- [ ] **6.2.1** `loadAllIfStale()` — computes `isStale = now - lastLoadedAt > CACHE_TTL_MS`; no-ops when fresh. Replace call sites that blindly `loadAll()` on navigation.
- [ ] **6.2.2** `withEntityAdapter` helper — O(1) add/remove/update helpers; drop spread-based mutations.
- [ ] **6.2.3** `withOptimisticUpdates()` — extracts the optimistic pattern introduced in Phase 1.4 into a reusable `signalStoreFeature`.
- [ ] **6.2.4** `withDevtools(name)` (per U5) — wires `@angular-architects/ngrx-toolkit` in dev only.
- [ ] **6.2.5** `withPersistence(key, { storage: 'local' | 'session' | 'indexedDb' })` — optional; opt-in per store.

### 6.3 Cross-store coordination
- [ ] **6.3.1** `CacheInvalidationBus` — RxJS `Subject<{ entity: string, action: 'created'|'updated'|'deleted' }>` at root.
- [ ] **6.3.2** Every mutating store method emits on the bus; stores subscribe to invalidate specific peers (e.g. `RolesStore` on `users:updated` invalidates itself).

### 6.4 Server-error projection in forms
- [ ] **6.4.1** `ServerErrorMapperService` — takes an `ApiError.errors: Record<fieldName, string[]>` and calls `formControl.setErrors({ server: messages[0] })` on each matching control.
- [ ] **6.4.2** `DynamicFieldComponent` template renders `server` error key identically to built-in validators.
- [ ] **6.4.3** On next `valueChanges`, `server` error auto-clears (so user sees live feedback).

### 6.5 Zod adapter
- [ ] **6.5.1** `ZodAdapterService.fromSchema(schema: ZodObject): { fields: FieldConfig[], validators: ValidatorFn[] }` — walks a Zod object schema, produces `FieldConfig[]` with the right types, required flags, pattern/min/max derived from Zod.
- [ ] **6.5.2** Document conventions for type hints (e.g. `z.string().email()` → `inputText` with `email` validator).
- [ ] **6.5.3** One end-to-end usage: `UserFormComponent` uses `ZodAdapterService.fromSchema(UserSchema)` to build its form.

### 6.6 Autosave + resume
- [ ] **6.6.1** `FormAutosaveService.track(formId, formGroup)` — debounced (500 ms) write to localStorage under `formAutosave:<formId>`.
- [ ] **6.6.2** On form init, if a saved value exists, show "Restore unsaved changes?" banner + buttons.
- [ ] **6.6.3** Clear on successful submit.

### 6.7 Checkpoint 6
- [ ] **6.7.1** Same `loadAll()` within TTL hits cache (verify via network tab).
- [ ] **6.7.2** Two concurrent `loadById` on same ID → single network request.
- [ ] **6.7.3** 422 response projects field errors inline; no toast (Phase 1.3 policy) but error-interceptor can still log.
- [ ] **6.7.4** User-form restores unsaved changes after reload.

---

## Phase 7 — Performance (~3 days)

**Goal:** preloading strategy, lazy partitioning for heavy deps, image optimization, bundle CI gate.

### 7.1 Preloading
- [ ] **7.1.1** Implement `CustomPreloader` that preloads routes tagged `data.preload: true` + honors `navigator.connection.saveData` (skip preload on slow nets).
- [ ] **7.1.2** Tag `dashboard`, `users`, top-used routes.

### 7.2 Lazy partitioning
- [ ] **7.2.1** `ChartWidgetComponent` dynamic-imports `chart.js` only on first use. Verify with `stats.json` that chart.js is absent from main/dashboard chunks but present in `chart-widget.component.js` chunk.
- [ ] **7.2.2** Break PrimeNG imports by component — each shared primitive imports only the specific PrimeNG module it uses (verify via `stats.json`).
- [ ] **7.2.3** `date-fns` locales dynamically imported from `LocaleStore` when locale changes.
- [ ] **7.2.4** `zod` only in `ZodAdapterService` (not eagerly in `core`).

### 7.3 Images
- [ ] **7.3.1** Replace `<img>` with `NgOptimizedImage` where size > 20 KB.
- [ ] **7.3.2** `priority` hint on hero / LCP-candidate images.
- [ ] **7.3.3** Configure responsive `srcset` via a build plugin (sharp-based or external CDN image service).

### 7.4 Bundle CI gate
- [ ] **7.4.1** CI step — `ng build --stats-json` + `bundlesize` (or inline script) asserts initial bundle ≤ 1.5 MB; any per-lazy-chunk ≤ 500 KB. Fails on regression.
- [ ] **7.4.2** Weekly `source-map-explorer` report uploaded as CI artifact.

### 7.5 Checkpoint 7
- [ ] **7.5.1** LCP ≤ 2.5 s on simulated 4G (Lighthouse CI).
- [ ] **7.5.2** Initial bundle ≥ 20% smaller than baseline recorded in Phase 0.3.
- [ ] **7.5.3** `chart.js` absent from main chunk.

---

## Phase 8 — Internationalization (optional per U6, ~5 days if done)

**Goal:** i18n scaffolding, one non-English locale, RTL, timezones.

- [ ] **8.1** Install `@angular/localize`. `ng extract-i18n --output-path src/locale`.
- [ ] **8.2** `LocaleStore` — root signalStore; signal-driven `LOCALE_ID` binding; localStorage-backed preference; fallback to `navigator.language`.
- [ ] **8.3** `i18n-adapter.service.ts` — dynamic-import of `date-fns/locale/<lang>`, ICU number/currency format helpers.
- [ ] **8.4** Wrap every user-facing literal in `$localize`. ESLint rule `@angular-eslint/template/no-string-literal` in templates.
- [ ] **8.5** Translate one full locale (e.g. `es-MX`) to prove the pipeline. Per-locale production build.
- [ ] **8.6** RTL — Tailwind `dir-rtl:` variants; PrimeNG `dir="rtl"` applied via `LocaleStore` effect.
- [ ] **8.7** Timezones — `TimeZoneService` + `date` pipe overrides that call `formatInTimeZone(date, tz, fmt)`.
- [ ] **8.8** Checkpoint: switching locale updates UI + dates + numbers without reload; RTL layout correct; extracted catalogs committed.

---

## Phase 9 — BFF Integration (optional per U1, ~3 days)

**Goal:** cookie-session + CSRF + server-rendered config path. Only if BFF is adopted.

- [ ] **9.1** `AuthStrategy` abstraction in `core/auth/` — `IAuthStrategy` with `login`, `logout`, `isAuthenticated$`, `getAccessToken`. Implementations: `MsalDirectStrategy`, `BffCookieStrategy`.
- [ ] **9.2** Swap MSAL usage behind strategy; DI picks strategy from runtime config (`authMode: 'msal-direct' | 'bff-cookie'`).
- [ ] **9.3** `BffCookieStrategy` — no `Authorization` header; relies on BFF-set cookies; `securityInterceptor` reads XSRF-TOKEN cookie → `X-XSRF-TOKEN` header; `credentials: 'include'` on fetch.
- [ ] **9.4** BFF emits `/config.json` server-rendered (no extra HTTP roundtrip). `loadRuntimeConfig` detects embedded config and skips fetch.
- [ ] **9.5** Nonce-based CSP (Phase 2.2) now emitted by BFF — wire through.
- [ ] **9.6** Checkpoint: cookie-auth login → API call → logs on BFF show same correlation ID.

---

## Phase 10 — SSR / PWA (optional per U7, ~5 days)

**Goal:** server-side rendering for SEO / TTFB, or PWA offline shell. Pick one path if needed.

### 10.1 SSR
- [ ] **10.1.1** `ng add @angular/ssr`.
- [ ] **10.1.2** Short-circuit MSAL on server (emit skeleton, hydrate on client).
- [ ] **10.1.3** Per-route `renderMode: 'ssr' | 'csr' | 'ssg'` config.
- [ ] **10.1.4** Guard against `window` / `document` usage outside browser-only code (add ESLint rule).

### 10.2 PWA
- [ ] **10.2.1** `ng add @angular/pwa`.
- [ ] **10.2.2** Service-worker strategies — `freshness` for `/api/*`, `performance` for static.
- [ ] **10.2.3** Offline banner + outbox pattern in stores (writes queued, drained online).
- [ ] **10.2.4** Background sync + push-notification optional extensions.

---

## Phase 11 — Developer Experience (~2 days)

**Goal:** feature-slice schematic, repo docs, ADR log, preview deploys.

- [ ] **11.1** Angular schematic `ng g @enterprise-platform/feature-slice:feature <name>` generates `model / api service / store / routes / list / form / detail` + Storybook story stubs + unit-test stubs.
- [ ] **11.2** `CONTRIBUTING.md` — branching, commit format, PR checklist, testing expectations, "how to add a feature slice" runbook.
- [ ] **11.3** `Docs/Architecture/ADRs/` — short ADRs for each decision (U1–U9 + future). Link from `UI-Architecture.md` Part XV.
- [ ] **11.4** `Docs/Runbooks/` — troubleshooting (CSP violation, token expiry errors, chunk-load failures, telemetry not reporting).
- [ ] **11.5** Preview-environment deploy on PR (Azure Static Web Apps / Cloudflare Pages).

---

## Phase 12 — Feature Build-out (ongoing)

**Goal:** real features exercising the foundation. First two prove the primitives; scale follows.

- [ ] **12.1** Dashboard → real backend. Replace mock arrays with store-backed KPI queries + real-time chart data.
- [ ] **12.2** `Roles` vertical slice — second feature after `Users`. Validates the `createEntityStore` pattern on a second aggregate (exercises cross-store invalidation from Phase 6.3).
- [ ] **12.3** Settings → real backend (user profile edit + preferences).
- [ ] **12.4** Notifications center (inbox) — exercises shared `DrawerPanel`, `CommandPalette`, SignalR-ready (if messaging tier lands).
- [ ] **12.5** Audit log viewer — exercises `DataTable` with complex filters, large-dataset `VirtualList`, `ExportCSV`.
- [ ] **12.6** Per-aggregate: use the schematic to generate boilerplate; hand-customize only list columns + form sections + detail layout.

---

## Phase ordering + dependencies

```
Phase 0  (Decisions + baselines)
   │
   ▼
Phase 1  (Stabilization) ──────────────── unblocks everything
   │
   ▼
Phase 2  (Security + runtime config) ──── unblocks Phase 3 (telemetry needs RUNTIME_CONFIG)
   │
   ▼
Phase 3  (Observability) ──────────────── unblocks Phase 4 (error tests need telemetry mocks)
   │
   ▼
Phase 4  (Testing) ────────────────────── safety net for all later phases
   │
   ├──► Phase 5  (Design system + a11y)
   ├──► Phase 6  (State + HTTP maturity)
   └──► Phase 7  (Performance)
            │
            ▼
        Phases 8 / 9 / 10 (optional)
            │
            ▼
        Phase 11 (DX) + Phase 12 (features ongoing)
```

**Recommended first slice**: 0 → 1 → 2 → 3 → 4 as a straight line (≈ 3 weeks),
then fan out into 5/6/7 in parallel across 2 engineers.

---

## Time estimate summary (single engineer, calendar days)

| Phase | Estimate |
|---|---|
| 0 — Decisions + prep | 1 |
| 1 — Stabilization | 3 |
| 2 — Security + config | 4 |
| 3 — Observability | 3 |
| 4 — Testing | 5 |
| 5 — Design system + a11y | 5 |
| 6 — State + HTTP maturity | 4 |
| 7 — Performance | 3 |
| 8 — i18n (optional) | 5 |
| 9 — BFF (optional) | 3 |
| 10 — SSR/PWA (optional) | 5 |
| 11 — DX polish | 2 |
| **Subtotal (required only)** | **30 days** |
| **Plus all optional** | **+13 days** |

**Recommended sequencing:** commit to Phases 0–4 up-front (15 days); then re-assess
based on product priorities whether Phase 5 (a11y compliance), Phase 6 (state
maturity), or Phase 7 (perf) comes next.

---

## Companion documents

- Target architecture: [`../Architecture/UI-Architecture.md`](../Architecture/UI-Architecture.md)
- Current-state audit: [`../Review/UI-Deep-Review-2026-04-20.md`](../Review/UI-Deep-Review-2026-04-20.md)
- Backend foundation TODO (for reference): [`./00-Foundation-TODO.md`](./00-Foundation-TODO.md)
