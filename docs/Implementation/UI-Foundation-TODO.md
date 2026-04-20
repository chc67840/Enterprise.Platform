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
- [ ] **2.1.1** Define `RuntimeConfig` TS type (apiBaseUrl, msal, tenantMode, sentryDsn/appInsightsKey, featureFlags, telemetryEndpoint).
- [ ] **2.1.2** Create `src/app/config/runtime-config.ts` — `RUNTIME_CONFIG` injection token + `loadRuntimeConfig()` factory that fetches `/config.json` during `provideAppInitializer`.
- [ ] **2.1.3** Ship `public/config.json` with dev defaults; document that each env overwrites it during deployment.
- [ ] **2.1.4** Refactor code referring to `environment.apiBaseUrl` / `environment.msal.*` / `environment.sentryDsn` to pull from `RUNTIME_CONFIG`. `environment.ts` shrinks to build-time flags (production / staging / buildStamp / offline-dev fallbacks only).
- [ ] **2.1.5** Unit tests: `loadRuntimeConfig` handles 200 / 404 / malformed JSON; falls back to `environment.ts` when offline.

### 2.2 CSP (BFF-hosted scenario prepared)
- [ ] **2.2.1** Draft nonce-based CSP policy in `Docs/Security/csp-policy.md` (see Architecture §3.4 for the baseline directives).
- [ ] **2.2.2** Audit codebase for inline `<style>` / `<script>` / `style=""` / `onerror=` patterns — fix to source-file / nonce form.
- [ ] **2.2.3** If BFF pattern adopted (U1 = C), wire per-response nonce generation in BFF; emit `<meta http-equiv="Content-Security-Policy" content="...{nonce}...">` in `index.html`.
- [ ] **2.2.4** If static-host scenario, emit same policy via host-level headers (SWA / CloudFront / Nginx).
- [ ] **2.2.5** Add `report-uri` / `report-to` pointing at telemetry endpoint; wire a `csp-violation-reporter.service.ts` that listens to `securitypolicyviolation` events in-browser and forwards to telemetry.

### 2.3 Correlation + audit propagation
- [ ] **2.3.1** Create `correlation.interceptor.ts` — generates a UUID v4 per request, attaches `X-Correlation-ID`. If a W3C `traceparent` is ambient (from OTEL-web, Phase 3), propagate that instead.
- [ ] **2.3.2** Insert in interceptor chain as #2 (after MSAL, before tenant).
- [ ] **2.3.3** `LoggerService.log(level, message, ctx)` picks up the active correlation ID via a per-request `AsyncContext` (or ambient signal) so every log message is correlatable.

### 2.4 Session-expiry UX
- [ ] **2.4.1** `SessionMonitorService` (root singleton) — subscribes to MSAL `acquireTokenSilent` flow; computes time-to-expiry from active account's `idTokenClaims.exp`.
- [ ] **2.4.2** At `exp - 120s` emit a `sessionExpiringSoon` signal. `AppShell` renders a `<p-dialog>` with "Your session will expire in {n} seconds — stay signed in?" + "Sign out" buttons. The "Stay" button triggers `acquireTokenSilent`.
- [ ] **2.4.3** On unrecoverable token-acquisition failure → toast "Session expired" + navigate to `/auth/login?returnUrl=...`.
- [ ] **2.4.4** `document.addEventListener('visibilitychange')` — when returning to a tab, refresh account state and trigger silent refresh if token near/past expiry.

### 2.5 Secrets hygiene
- [ ] **2.5.1** Add `eslint-plugin-no-secrets` to lint config. Tune entropy threshold to catch API keys / JWTs but not UUIDs.
- [ ] **2.5.2** Add `gitleaks` (or `trufflehog`) pre-commit hook — Husky calls it on staged files.
- [ ] **2.5.3** Document in `README.md`: `public/config.json` must never contain secrets; MSAL clientId is public-ID only.

### 2.6 Checkpoint 2
- [ ] **2.6.1** Per-env `/config.json` overrides `apiBaseUrl` / `msal.clientId` without a rebuild.
- [ ] **2.6.2** CSP headers / meta present on every HTML response; no `unsafe-inline` allowed; no CSP violations in prod smoke test.
- [ ] **2.6.3** Session-expiring dialog appears ≈ 2 min before token expiry in a manual test.
- [ ] **2.6.4** `gitleaks` gate rejects a test commit containing a fake AWS key.

---

## Phase 3 — Observability (~3 days)

**Goal:** telemetry wired, web vitals reported, correlation end-to-end, error boundaries in place.

### 3.1 Telemetry SDK
- [ ] **3.1.1** Per U4 decision, install SDK (Application Insights: `@microsoft/applicationinsights-web`; or Sentry: `@sentry/angular`).
- [ ] **3.1.2** Create `telemetry.service.ts` in `core/services/` — thin facade over SDK: `trackError`, `trackEvent`, `trackPageView`, `trackMetric`, `setUserContext`, `setReleaseTag`.
- [ ] **3.1.3** `provideAppInitializer(() => inject(TelemetryService).init())` — reads `RUNTIME_CONFIG` for DSN / instrumentation key, sets release tag from `environment.buildStamp`, user context from `AuthService.currentUser()`.
- [ ] **3.1.4** Scrub PII: extend `LoggerService.scrub()` rules, pipe all telemetry payloads through the scrubber. Unit-test the scrubber with realistic entity shapes.

### 3.2 Global error handler
- [ ] **3.2.1** Replace default Angular `ErrorHandler` with `GlobalErrorHandlerService` that:
  - calls `TelemetryService.trackError(error, { correlationId, userId, route })`;
  - shows a user-friendly toast (unknown errors: "Something went wrong");
  - navigates to `/error/server-error` on fatal errors (e.g. chunk-load errors, router navigation errors);
  - silent for HttpErrorResponse (owned by errorInterceptor).
- [ ] **3.2.2** Route-level error boundary — `RouterErrorBoundaryComponent` wraps a feature's outlet; catches render-time errors via Angular 16+ `ErrorHandler` + `ComponentRef`; shows `ErrorStateComponent` with retry.

### 3.3 Web vitals
- [ ] **3.3.1** Install `web-vitals`. In `TelemetryService.init`, wire `onLCP / onINP / onCLS / onFCP / onTTFB` → `trackMetric`.
- [ ] **3.3.2** Sample at 10% in prod (configurable via runtime config).
- [ ] **3.3.3** Add a `BUDGETS` constant: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. Telemetry tags metrics that exceed budget so dashboards can alert.

### 3.4 Correlation end-to-end
- [ ] **3.4.1** Verify (integration test) that a request emitted from the frontend reaches the backend with the same `X-Correlation-ID`; backend's `StructuredLoggingSetup` includes it; a single trace in App Insights / Sentry stitches both tiers.

### 3.5 Checkpoint 3
- [ ] **3.5.1** Intentionally throw from a component — error appears in App Insights/Sentry with stack trace, route, user context, correlation ID.
- [ ] **3.5.2** Navigate five routes — web vitals metrics appear in telemetry.
- [ ] **3.5.3** Trigger a 500 via API — frontend shows toast + tracks error; backend log and frontend error share correlation ID.

---

## Phase 4 — Testing Foundation (~5 days)

**Goal:** Vitest specs for every load-bearing primitive, Playwright E2E happy paths, coverage gate in CI, architecture tests with `dependency-cruiser`.

### 4.1 Unit tests
- [ ] **4.1.1** `base-entity.store.spec.ts` — `createEntityStore` factory:
  - loadAll success → patches ids/entities/pagination/loaded-at/stale;
  - loadAll error → patches error, doesn't touch entities;
  - loadAll cancels prior via switchMap (simulated with delayed mock);
  - loadAllIfStale honors TTL (will be available post-Phase 6);
  - create/update/delete mutate ids + entities correctly;
  - bulkDelete removes from selectedIds too.
- [ ] **4.1.2** One spec per `with-*.feature.ts` (isolated state shape + methods).
- [ ] **4.1.3** `base-api.service.spec.ts` — URL building, `HttpParams` encoding (pagination, sort, filters with special chars), `If-Match` header on update/patch.
- [ ] **4.1.4** One spec per interceptor:
  - `retry` — only retries 5xx, only on safe methods, exponential backoff, respects `X-Skip-Retry`;
  - `error` — normalizes, toasts per status, skips 401 (MSAL owns), respects `X-Skip-Error-Handling`;
  - `loading` — counter balanced even on error, respects `X-Skip-Loading`;
  - `correlation` — generates UUID, propagates `traceparent` when present;
  - `tenant` — attaches header, skips when no tenant resolved;
  - `security` — CSRF cookie → header, only for `/api/`;
  - `cache` (post-Phase 6) — TTL respected, `X-Skip-Cache` works;
  - `dedup` (post-Phase 6) — identical in-flight `GET` returns the same Observable.
- [ ] **4.1.5** One spec per guard:
  - `authGuard` — unauth → redirect with returnUrl;
  - `permissionGuard` — AND logic; fails → forbidden;
  - `roleGuard` — OR logic;
  - `ownershipGuard` (post-Phase 2) — resolves resource id, calls API, gates accordingly;
  - `featureFlagGuard` (post-Phase 2);
  - `unsavedChangesGuard` — dirty form prompts.
- [ ] **4.1.6** `auth.service.spec.ts` + `auth.store.spec.ts`.
- [ ] **4.1.7** `form-builder.service.spec.ts` — config → FormGroup, validators mapped, disabledWhen reactivity, initialData patched, nested sections traversed.
- [ ] **4.1.8** `validation-mapper.service.spec.ts` — every built-in validator type + custom.
- [ ] **4.1.9** `server-error-mapper.service.spec.ts` (post-Phase 6) — projects 422 errors onto right FormControls.
- [ ] **4.1.10** One spec per shared pipe.

### 4.2 Component tests (harnesses)
- [ ] **4.2.1** `DataTableComponent` — render, pagination, sort click, action click, empty state, error state.
- [ ] **4.2.2** `DynamicFieldComponent` — per-type render, value change propagates to FormControl, validation error display.
- [ ] **4.2.3** `PageHeaderComponent` — title / breadcrumbs / action buttons.
- [ ] **4.2.4** `ConfirmDialogComponent` — confirm / cancel paths.
- [ ] **4.2.5** `*appHasPermission` / `*appHasRole` directives — render-when-true, hide-when-false, reactive to signal changes.

### 4.3 Architecture tests
- [ ] **4.3.1** Add `dependency-cruiser` + config enforcing:
  - `core` cannot depend on `features`, `layouts`, `shared/components/*` (types OK);
  - `features/A` cannot depend on `features/B`;
  - `shared` cannot depend on `core/services` or `features`;
  - no runtime import of `@env/environment` outside `config/` and `core/services/telemetry|feature-flag|logger`.
- [ ] **4.3.2** CI step `npm run arch:check` fails the build on any violation.

### 4.4 E2E (Playwright)
- [ ] **4.4.1** Install Playwright + `@axe-core/playwright`. Configure MSAL dev-login stub (use Entra test tenant account).
- [ ] **4.4.2** Specs:
  - login → dashboard;
  - users list → create → detail → edit → delete (happy path);
  - unauthenticated visits `/users` → redirected to login with returnUrl;
  - authenticated user without `users:read` → `/users` → forbidden;
  - dirty form navigation prompt;
  - keyboard-only AppShell traversal;
  - `axe` scan of users-list, user-form, dashboard — zero violations.

### 4.5 Coverage gates
- [ ] **4.5.1** Configure `vitest --coverage` with v8/istanbul.
- [ ] **4.5.2** Per-tier thresholds (Architecture §8.7). CI fails on dip.

### 4.6 Checkpoint 4
- [ ] **4.6.1** `npm run test:unit` — ≥ 250 specs; all green; coverage gate passes.
- [ ] **4.6.2** `npm run test:e2e` — all happy paths green in headless mode.
- [ ] **4.6.3** `npm run arch:check` — 0 violations.

---

## Phase 5 — Design System & Accessibility (~5 days)

**Goal:** Storybook, visual regression, token export, a11y baseline, missing shared primitives.

### 5.1 Storybook
- [ ] **5.1.1** Install Storybook 8+ with `@storybook/angular` + vite-builder. Configure theme switch (light/dark) + RTL toggle.
- [ ] **5.1.2** One story per shared primitive (DataTable, PageHeader, EmptyState, ErrorState, DetailView, DrawerPanel, StatCard, StatusBadge, Timeline, ChartWidget, StepperForm, LoadingOverlay, GlobalProgressBar).
- [ ] **5.1.3** One story per dynamic-form field control (22 total).
- [ ] **5.1.4** Stories render at `xs / sm / md / lg / xl / 2xl` viewports.
- [ ] **5.1.5** Install `@storybook/addon-a11y` + `@storybook/test-runner`. `npm run storybook:test` runs all stories through axe; zero violations required.

### 5.2 Visual regression
- [ ] **5.2.1** Per U9 decision (Playwright screenshots preferred):
  - `e2e/visual/*.spec.ts` opens Storybook URLs, snapshots each story;
  - baseline images committed under `e2e/visual/__screenshots__/`;
  - CI runs on PRs; reviewer approves diffs through a web view.

### 5.3 Design tokens export
- [ ] **5.3.1** Refactor `src/styles/tokens.css` — canonicalize every `--ep-*` custom property (radii, spacing, transitions, z-index, shadows, breakpoints).
- [ ] **5.3.2** Generate Tailwind `theme.extend.*` from tokens via a build-time script so both Tailwind utilities and PrimeNG theme pull from the same source.
- [ ] **5.3.3** Publish a `Tokens.stories.mdx` page in Storybook listing every token + usage guidance.

### 5.4 Missing shared primitives
- [ ] **5.4.1** `SkeletonCardComponent` — variants: `card`, `list-row`, `table-row`, `chart`, `stat-card`. Replace `LoadingOverlayComponent` usage inside grids / lists.
- [ ] **5.4.2** `VirtualListComponent` — `cdk-virtual-scroll-viewport` wrapper for very long client-side lists.
- [ ] **5.4.3** `FilePreviewComponent` — content-type aware (image inline, PDF via `<embed>`, Office via Office Online viewer URL, text via `<pre>`).
- [ ] **5.4.4** `CommandPaletteComponent` — ⌘K launcher searching `ROUTE_METADATA` + entity stores via a pluggable `SearchProvider` contract.

### 5.5 A11y baseline
- [ ] **5.5.1** Audit every shared primitive — keyboard reachability, focus visible styles, `aria-*` coverage, contrast.
- [ ] **5.5.2** Install `focus-trap` and wire to modals, drawers, command palette. Verify ESC closes / focus returns to trigger.
- [ ] **5.5.3** `prefers-reduced-motion` honored: `animations.css` uses `@media (prefers-reduced-motion: reduce)` to disable animations; PrimeNG transitions set to `none` via theme override.
- [ ] **5.5.4** Semantic markup audit: `<main>`, `<nav>`, `<aside>`, `<article>`, `<section>` where appropriate; heading hierarchy validated via `axe-heading-order`.
- [ ] **5.5.5** `aria-live` on toast host (polite) + loading bar (assertive for errors only).

### 5.6 PrimeNG overrides pruning
- [ ] **5.6.1** Review `styles/primeng-overrides.css` (~70 KB). Re-express as `theme.config.ts` component tokens where possible. Target: reduce to < 20 KB of truly-bespoke overrides.

### 5.7 Checkpoint 5
- [ ] **5.7.1** `npm run storybook:test` — 0 a11y violations across all stories.
- [ ] **5.7.2** Visual-regression CI green (no unexpected diffs).
- [ ] **5.7.3** Reduced-motion OS setting honored in Storybook manual check.
- [ ] **5.7.4** PrimeNG overrides ≤ 20 KB.

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
