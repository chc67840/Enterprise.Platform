# UI Enterprise Architecture — Target Reference

> **Scope.** This document is the *target* architecture for the Angular 21 SPA
> (`enterprise-app`). It describes where the frontend needs to land to be
> production-grade for **any** enterprise domain (healthcare, finance, social
> services, LOB CRUD, marketplaces, regulated industries). It is the synthesis of
> the current-state audit ([`../Review/UI-Deep-Review-2026-04-20.md`](../Review/UI-Deep-Review-2026-04-20.md))
> plus every missing capability identified as necessary for production.
>
> **Companion plan.** For the phased roadmap that moves current → target, see
> [`../Implementation/UI-Foundation-TODO.md`](../Implementation/UI-Foundation-TODO.md).
>
> **Status legend throughout:** ✅ present and aligned · ⚠️ partial / dated (fix
> required) · 🧱 scaffolded (needs completion) · ❌ target state, not yet built.
> Anything without a marker is a convention/principle, not a state claim.

---

## Part I — Foundation Principles

### 1.1 Vision
A single-page Angular 21 application that is:
- **Domain-agnostic.** The same shell, state primitives, form engine, HTTP layer,
  and observability are used to build any line-of-business UI regardless of
  industry. Domain code lives strictly in `features/*`.
- **Production-hardened.** Auth, CSP, telemetry, error handling, performance
  budgets, and a11y baselines are wired before any feature ships.
- **Schema-driven where possible.** Forms, DTOs, validators are generated from
  (or aligned to) the backend's OpenAPI + Zod schemas so cross-tier drift is
  structurally prevented.
- **Minimally ceremonious.** Adding a new aggregate is 3–5 files
  (`model`, `api service`, `store`, `routes`, `components/`) thanks to
  reusable primitives; `createEntityStore` + `BaseApiService` do the heavy lift.

### 1.2 Design principles
1. **Zoneless + signals + standalone.** No `Zone.js`, no `NgModule`, no
   `BehaviorSubject` where a signal fits.
2. **Functional everything** — guards, interceptors, resolvers, injections.
   Class-based is reserved for library-mandated cases (e.g. `MsalInterceptor`).
3. **Route-scoped feature stores.** Feature stores live only while the route is
   active; root-scoped services are reserved for genuinely global state
   (auth, theme, layout, loading, notifications).
4. **Single-source-of-truth contracts.** DTOs, enums, and validators are
   generated from the backend's OpenAPI / Zod schemas or hand-mirrored with a
   drift-checker test.
5. **One owner per concern.** Each cross-cutting UX concern (HTTP-error
   toasting, loading indication, auth state, tenant resolution, correlation ID)
   has exactly one owner — no double-firing from interceptor AND store.
6. **Fail loud in dev, fail gracefully in prod.** Strict TypeScript + strict
   template checks in dev; telemetry-reported, user-friendly fallbacks in prod.
7. **Defense in depth.** Permission checks exist in UI (for UX), at the HTTP
   boundary (for auth), and at the API (authoritative). Never trust any one
   layer.
8. **Accessible by default.** Every shared primitive ships with keyboard
   navigation, `aria-*` attributes, and a Storybook a11y check.
9. **Bundle discipline.** Heavy dependencies (charts, editors, maps) lazy-load
   behind the feature that actually needs them.

### 1.3 Tier model

| Tier | Path | Role | Depends on |
|---|---|---|---|
| **Config** | `src/app/config/` | All cross-cutting providers — MSAL, PrimeNG, routing, interceptors, runtime config | `environments/` |
| **Core** | `src/app/core/` | Non-feature singletons — auth, guards, HTTP base, interceptors, models, cross-cutting services, base store factory | `config/`, `shared/` (types only) |
| **Shared** | `src/app/shared/` | Reusable UI primitives, structural directives, pipes, dynamic-form subsystem | `core/` (types only) |
| **Layouts** | `src/app/layouts/` | Outer chromes — `AppShell` (authed) + `AuthLayout` (public) + `ErrorLayout` | `core/`, `shared/` |
| **Features** | `src/app/features/` | Vertical slices — each a self-contained `model/`, `services/`, `store/`, `components/`, `routes.ts` | `core/`, `shared/`, `layouts/` |
| **Environments** | `src/environments/` | Build-time config POCOs (dev / staging / production) | (none) |
| **Styles** | `src/styles/` | Global CSS — tokens, typography, scrollbars, animations, PrimeNG overrides | (none) |

**Enforcement.** Tier rules are enforced by:
1. ESLint `import/no-restricted-paths` rules (❌ today — Phase 1 of implementation plan).
2. `dependency-cruiser` architecture tests run in CI (❌ today — Phase 4).

---

## Part II — Runtime Architecture

### 2.1 Bootstrap

**Entry:** `src/main.ts` → `bootstrapApplication(AppComponent, appConfig)`.

**Pre-Angular work in `main.ts`** is kept minimal:
- ✅ Capture uncaught errors early (`provideBrowserGlobalErrorListeners()`).
- ⚠️ A global `MutationObserver` currently suppresses browser autofill on
  PrimeNG inputs. **Target:** replace with an `autocomplete-off.directive.ts`
  applied via a `<Root>`-scoped observer limited to PrimeNG-rendered subtrees.

**Provider graph** (`src/app/config/app.config.ts`) in strict order:

1. `provideZonelessChangeDetection()` — signals drive reactivity; Zone.js not bundled.
2. `provideRouter(routes, withComponentInputBinding(), withViewTransitions(), withRouterConfig({ onSameUrlNavigation: 'reload' }), withPreloading(CustomPreloader))` — ⚠️ `withPreloading` is target-state, not present today.
3. `provideHttpClient(withInterceptorsFromDi(), withInterceptors([...]))` with the canonical interceptor chain (see §4.3).
4. `provideAnimationsAsync()` — required by PrimeNG; deferred load.
5. `providePrimeNG(primeNgConfig)` + `MessageService` + `ConfirmationService` + `DialogService`.
6. MSAL tokens (`MSAL_INSTANCE`, `MSAL_GUARD_CONFIG`, `MSAL_INTERCEPTOR_CONFIG`) + services (`MsalService`, `MsalGuard`, `MsalBroadcastService`).
7. `provideAppInitializer(() => initializeMsal())` — **modern API**; replaces the deprecated `APP_INITIALIZER` multi-provider.
8. `provideAppInitializer(() => loadRuntimeConfig())` — fetches `/config.json` at boot (§2.2).
9. Injection tokens — `API_BASE_URL`, `FEATURE_FLAGS`, `CORRELATION_ID_STRATEGY`, `LOCALE_ID`.

### 2.2 Runtime configuration

**Problem.** `environment.ts` is baked at build time. Rotating an API URL or
feature flag per-deployment requires a rebuild and therefore a new hash-stamped
bundle — wrong shape for container/K8s deployments.

**Target.** A boot-time fetch of `/config.json` served by the hosting origin:

```
app.config.ts
  → provideAppInitializer(async () => {
       const runtimeConfig = await fetch('/config.json').then(r => r.json());
       RUNTIME_CONFIG.set(runtimeConfig);
     })
  → provideRuntimeConfig(RUNTIME_CONFIG)  // exposes RuntimeConfig via DI token
```

**Layering:**

| Source | Role | Example values |
|---|---|---|
| `environment.ts` (build-time) | Immutable baseline — Angular feature flags (production/staging), build stamp, fallback values for offline dev | `production: true`, `buildStamp: '2026-04-20T14:22Z'` |
| `/config.json` (runtime) | Deployment-specific — API URL, tenant-id header mode, MSAL client/tenant IDs, Sentry DSN, feature-flag overrides | `apiBaseUrl: 'https://api.eu.example.com'`, `msal: { clientId, tenantId }`, `sentryDsn: '...'` |
| `localStorage: 'user-prefs'` | Per-user — theme, locale, sidebar-collapsed, recently-used filters | `theme: 'dark'`, `locale: 'es-MX'` |

**Security constraint.** `/config.json` must never contain secrets. MSAL
`clientId` is a public identifier; API keys/JWT signing keys never appear.

### 2.3 Change detection

- `provideZonelessChangeDetection()` is mandatory.
- Every component declares `changeDetection: ChangeDetectionStrategy.OnPush`.
- Effect functions (`effect(() => ...)`) are used sparingly — prefer `computed`
  for derivation; prefer `rxMethod` for async.
- `toSignal()` / `toObservable()` interop is used at leaf edges only (e.g.
  `ActivatedRoute.params → toSignal(...)`), never in store methods.

---

## Part III — Security Architecture

### 3.1 Authentication

**Active mode (Phase 9 onward): BFF cookie-session.** The Angular SPA never
sees a token. The BFF (`Enterprise.Platform.Web.UI` on `:5001`) runs the
OIDC code+PKCE flow against Azure Entra server-side, stashes the access /
refresh tokens in the cookie ticket via `SaveTokens = true`, and issues a
`HttpOnly` + `Secure` + `SameSite=Strict` session cookie. The browser only
ever ships that cookie. Downstream Api calls flow through `BffProxyController`
(`/api/proxy/{**path}`), which attaches the stashed bearer to the outbound
request server-side. Refresh-token rotation runs proactively in the cookie
scheme's `OnValidatePrincipal` event (`BffTokenRefreshService`).

```
User click → AuthService.login(returnUrl)
  → window.location.href = '/api/auth/login?returnUrl=…'    (top-level nav)
  → BFF AuthController.Login → Challenge(OidcScheme)
  → Azure login (creds + MFA)
  → /signin-oidc callback → OpenIdConnectHandler exchanges code → tokens
  → Cookie scheme writes ep.bff.session ticket, redirects to returnUrl
  → SPA reloads at returnUrl; provideAppInitializer awaits AuthService.refreshSession()
  → All signals (currentUser/isAuthenticated/roles) populated from /api/auth/session
  → Router resolves; authGuard allows through
```

**Retired mode: MSAL-direct (Phase 7.6, removed 2026-04-21).** The
`@azure/msal-browser` + `@azure/msal-angular` packages were uninstalled and
all MSAL code paths deleted. The SPA cannot speak directly to Entra anymore.
Rationale: closes the XSS token-exposure window, eliminates CORS, shrinks
the bundle, and unifies telemetry on the BFF.

**AuthService public contract** (Phase 9 implementation):

| Signal / method | Type | Source |
|---|---|---|
| `currentUser()` | `Signal<CurrentUser \| null>` | `/api/auth/session` projection |
| `isLoading()` | `Signal<boolean>` | `false` once initial session probe resolves |
| `isAuthenticated()` | `Computed<boolean>` | `_session()?.isAuthenticated === true` |
| `displayName() / email()` | `Computed<string>` | `name` / `email` from session JSON |
| `roles()` | `Computed<readonly string[]>` | session response `roles` array |
| `expiresAt()` | `Computed<number \| null>` | session response `expiresAt` (ms epoch) |
| `login(returnUrl?)` | top-level navigation | navigates to `/api/auth/login?returnUrl=…` |
| `logout(returnUrl?)` | transient form POST | navigates browser to `/api/auth/logout` (cookie clear + Entra single sign-out) |
| `refreshSession()` | async method | `GET /api/auth/session`; called by app initializer + on demand |
| `getAccessToken(scopes)` | `Promise<string \| null>` | `acquireTokenSilent` + interactive fallback |
| `hasRole / hasAnyRole` | bool | case-insensitive role check |
| `hasPermission / hasAnyPermission / hasAllPermissions` | bool | case-insensitive permission check |

**Modernization required:**
- ⚠️ Replace manual `destroy$` + `OnDestroy` with `takeUntilDestroyed(DestroyRef)`.
- ⚠️ Replace deprecated `APP_INITIALIZER` with `provideAppInitializer(() => inject(MsalService)...)`.

**Cross-tab synchronization.** `BroadcastChannel('msal:auth')` posts `logout` so
other open tabs clear their `currentUser` signal.

### 3.2 Authorization (RBAC + ABAC)

The current code aliases `permissions` to `roles`. The **target** separates
them:

```
Roles (coarse)               Permissions (fine)              ABAC (contextual)
------                       -----                           ----
'admin'                      'users:read'                    isOwner(doc)
'manager'                    'users:create'                  sameTenant(doc)
'user'                       'reports:export'                withinBusinessHours()
                             'billing:refund'
                             'pii:view'
```

**Data flow for permission hydration:**

```
Login completes (AuthService.syncAccount)
  ↓ effect()
loadEffectivePermissions()  ← calls GET /api/v1/me/permissions
  ↓
  → response: { roles: [...], permissions: [...], tenantId, bypass: false }
  ↓ patchState in AuthStore (signalStore)
permissions() signal now authoritative
```

**Guards catalog:**

| Guard | Semantics | Usage |
|---|---|---|
| `authGuard` | Require authenticated user | `canActivate: [authGuard]` |
| `roleGuard(...roles)` | OR across roles | `canActivate: [authGuard, roleGuard('admin','manager')]` |
| `permissionGuard(...perms)` | AND across permissions | `canActivate: [authGuard, permissionGuard('users:read')]` |
| `anyPermissionGuard(...perms)` | OR across permissions | `canActivate: [authGuard, anyPermissionGuard('reports:read','reports:export')]` |
| `ownershipGuard(resolver)` | Resource-scoped — caller supplies a resolver that returns `(activatedRoute) → resourceId`; guard calls `api.canAccess(resourceId)` | `canActivate: [authGuard, ownershipGuard(r => r.paramMap.get('id'))]` (❌ not yet built) |
| `featureFlagGuard(flag)` | Runtime-flag gate | `canActivate: [featureFlagGuard('users.bulkDelete')]` (❌) |
| `unsavedChangesGuard` | Confirm-on-leave for dirty forms | `canDeactivate: [unsavedChangesGuard]` |

**`*appHas...` directives** (structural) give the same checks in templates:
- `*appHasRole="'admin'"`, `*appHasPermission="'users:read'"`, `*appHasAnyPermission="['a','b']"`.

**Super-admin bypass.** A single string (`super:admin`) is treated as an
always-allow. **Target:** replace with a `bypass: boolean` flag on the
effective-permissions response (auditable, revocable server-side, not a
hard-coded client string).

### 3.3 Session management

Required UX (❌ not built):

- **Idle-timeout warning modal.** At `T - 120s` before token expiry, show
  "Your session will expire in 2 minutes" with "Continue" (triggers silent
  `acquireTokenSilent`) or "Sign out" buttons.
- **Failed silent-refresh handler.** If `acquireTokenSilent` throws at the
  interceptor layer, `errorInterceptor` catches it, shows "Your session
  expired — please sign in again", and navigates to `/auth/login`.
- **Dead-tab recovery.** If tab was backgrounded past token expiry, `AuthService`
  detects stale account on `visibilitychange` and triggers re-auth or silent
  refresh.

### 3.4 Transport security (headers, CSP, CSRF)

| Header | Source | Target state |
|---|---|---|
| `Authorization: Bearer <token>` | MSAL interceptor | ✅ |
| `X-Tenant-ID: <uuid>` | `tenantInterceptor` on `/api/` URLs | ✅ |
| `X-CSRF-Token` / `X-XSRF-TOKEN` | `securityInterceptor` reads XSRF-TOKEN cookie | ✅ (needs BFF backing cookie) |
| `X-Requested-With: XMLHttpRequest` | `securityInterceptor` | ✅ |
| `X-Content-Type-Options: nosniff` | `securityInterceptor` | ✅ |
| `X-Correlation-ID: <uuid>` | `correlationInterceptor` (❌ — Phase 3) | generate per-request or propagate from W3C `traceparent` |

**CSP** (❌ not yet set):
- Preferred: nonce-based CSP issued by BFF on every HTML response.
  ```
  default-src 'self';
  script-src 'self' 'nonce-<random>' 'strict-dynamic';
  style-src 'self' 'nonce-<random>';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://api.example.com https://login.microsoftonline.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  upgrade-insecure-requests;
  ```
- Tailwind v4's `@inline` output → ship styles via external CSS files only.
  No component-inline `<style>` without nonce.
- `report-uri` / `report-to` to telemetry endpoint.

**Sub-resource integrity.** No external scripts/styles today — keep it that
way. If adding a CDN asset, emit `<link integrity>`/`<script integrity>` via a
build plugin.

**Clickjacking.** `frame-ancestors 'none'` (CSP). BFF also sends
`X-Frame-Options: DENY`.

### 3.5 Content safety

- No direct `innerHTML` / `[innerHTML]` assignments. Enforce via ESLint rule
  (`@angular-eslint/no-inner-html` or local rule) — ❌ not configured.
- User-generated markdown rendered through a trusted sanitizer
  (`dompurify` + Angular's `DomSanitizer`, not `bypassSecurityTrustHtml`).
- File uploads gated through `IFileStorageService`; server-side virus-scan
  expected (backend concern).

### 3.6 Secrets hygiene

- `environment.*.ts` contain NO secrets — only public identifiers.
- `/config.json` contains NO secrets — same rule.
- ESLint rule `no-secrets` ❌ — Phase 1.
- Pre-commit hook rejects files matching secret patterns — Phase 1.

---

## Part IV — Data Flow & State

### 4.1 Layer diagram

```
                Component (template + signal subscription)
                           │
                           ▼ inject(FooStore)
              Feature Store (signalStore, rxMethod)
                           │
                           ▼ inject(serviceType) — FooApiService
              Feature API service (extends BaseApiService<Foo>)
                           │
                           ▼ http.get/post/put/patch/delete
                HttpClient  →  interceptor chain
                           │
                           ▼
                         Network
```

### 4.2 HTTP contracts

`core/models/api-response.model.ts`:

```ts
PagedResponse<T> = { data: T[]; total; page; pageSize; totalPages; hasNext; hasPrev }
ApiResponse<T>   = { data: T; message?; success }
ApiError         = { message; code?; errors?: Record<string, string[]>; statusCode; timestamp?; correlationId? }
```

`BaseApiService<T extends BaseEntity>`:

| Method | URL | Returns |
|---|---|---|
| `getAll(params?)` | `GET {baseUrl}/{endpoint}?page&pageSize&q&sortBy&sortDir&<filters>` | `Observable<PagedResponse<T>>` |
| `getById(id)` | `GET {baseUrl}/{endpoint}/{id}` | `Observable<ApiResponse<T>>` |
| `create(entity)` | `POST {baseUrl}/{endpoint}` | `Observable<ApiResponse<T>>` |
| `update(id, entity)` | `PUT {baseUrl}/{endpoint}/{id}` + `If-Match: <version>` | `Observable<ApiResponse<T>>` ⚠️ version header not wired today |
| `patch(id, entity)` | `PATCH {baseUrl}/{endpoint}/{id}` + `If-Match: <version>` | `Observable<ApiResponse<T>>` ⚠️ |
| `delete(id)` | `DELETE {baseUrl}/{endpoint}/{id}` | `Observable<void>` |
| `bulkDelete(ids)` | `POST {baseUrl}/{endpoint}/bulk-delete` | `Observable<void>` |

**Optimistic concurrency.** `update` / `patch` **must** send `If-Match` with
the current `version` field (or last `ETag` header). The backend's
`RowVersion` check returns `409 Conflict` on mismatch; the error interceptor
recognizes this code and shows a "record changed, please refresh" toast
with a refetch action.

### 4.3 Interceptor chain (canonical order)

| # | Interceptor | Kind | Responsibility | Opt-out header |
|---|---|---|---|---|
| 1 | `MsalInterceptor` | DI class (lib) | Attach Bearer for `protectedResourceMap` URLs | (MSAL-controlled) |
| 2 | `correlationInterceptor` ❌ | fn | Generate/propagate `X-Correlation-ID` | — |
| 3 | `tenantInterceptor` ✅ | fn | Attach `X-Tenant-ID` on `/api/` URLs | — |
| 4 | `securityInterceptor` ✅ | fn | Attach XSRF, X-Requested-With, nosniff | — |
| 5 | `cacheInterceptor` ❌ | fn | Serve `GET` responses from in-memory TTL cache | `X-Skip-Cache` |
| 6 | `dedupInterceptor` ❌ | fn | Single-flight identical in-flight `GET`s | `X-Skip-Dedup` |
| 7 | `loadingInterceptor` ✅ | fn | Inc/dec `LoadingService` counter | `X-Skip-Loading` |
| 8 | `loggingInterceptor` ✅ | fn | Dev-only console logs (method/URL/status/elapsed) | — |
| 9 | `retryInterceptor` ✅ | fn | Retry 5xx on safe methods; exponential backoff + jitter | `X-Skip-Retry` |
| 10 | `errorInterceptor` ✅ | fn | Normalize → `ApiError`, toast by status, navigate on 403 | `X-Skip-Error-Handling` |

**Ownership policy.** `errorInterceptor` is the **sole** owner of HTTP-error
toast UX. Stores must not call `notification.error(...)` in failure handlers;
they only propagate `error` into their own `error()` signal for form-level
display. (Review #7 — must fix.)

### 4.4 State management (NGRX Signals)

**Factory: `createEntityStore<T>(config)`.** Composes:

```
signalStore(
  withState<EntityDataState<T>>({ ids: [], entities: {}, activeId: null,
                                  lastLoadedAt: null, isStale: true }),
  withLoadingState(),      // loading, loadingDetail, saving, deleting, error
  withPagination(default), // page, pageSize, total, totalPages, hasNext, hasPrev
  withSearch(),            // queryParams, searchQuery, activeFilters
  withSelection(),         // selectedIds
  withComputed(...),       // allEntities, activeEntity, entityCount, isEmpty
  withMethods(...),        // loadAll, loadById, create, update, delete, invalidate
)
```

**Target enhancements on top of current factory:**

- ❌ `loadAllIfStale()` — consult `CACHE_TTL_MS` + `lastLoadedAt`; only refetch
  when stale. Eliminates redundant fetches on every navigation.
- ❌ `withDevtools(name)` — wire NGRX Signals devtools (`@angular-architects/ngrx-toolkit`)
  so store timeline + state snapshots are inspectable.
- ❌ `withEntityAdapter()` — O(1) add/remove helpers instead of spread-based
  mutations; necessary once any store holds > 1k rows.
- ❌ `withOptimisticUpdates()` — reversible `updateEntity` that patches
  optimistically, rolls back on server error.
- ❌ `withPersistence(key)` — opt-in localStorage/IndexedDB persistence for
  offline-resilient slices.

**Cross-store coordination** (❌ not built):
`CacheInvalidationBus` — event bus (RxJS `Subject`) that lets writes in one
store signal staleness in others. E.g. deleting a role marks the users store
stale, so the next `loadAllIfStale()` refetches.

### 4.5 Provision lifetime

| Store | Scope | Rationale |
|---|---|---|
| `AuthStore` / `ThemeStore` / `LayoutStore` / `NotificationStore` / `LoadingService` / `TenantStore` | `providedIn: 'root'` | One app-wide instance; lifetime = app lifetime |
| Feature stores (`UsersStore`, etc.) | `providedIn: null` + `providers: [FooStore]` at the route | One instance per visit to `/foo/*`; destroyed on navigate-away — prevents memory bloat across large feature sets |

### 4.6 Offline / PWA (optional — Phase 10)

If domain demands offline:
- `@angular/pwa` service worker for app shell caching.
- IndexedDB (via `idb-keyval` or custom wrapper) for entity persistence.
- Outbox pattern in the store: writes queued locally, drained when online.
- Conflict resolution strategy chosen per aggregate (last-write-wins, CRDT,
  manual merge).

---

## Part V — UI Composition

### 5.1 Layouts

| Layout | Purpose | Wrapped children |
|---|---|---|
| `AppShellComponent` | Authed sidebar + header + global toast/confirm | All protected routes |
| `AuthLayoutComponent` | Centered card; no chrome | `/auth/*` |
| `ErrorLayoutComponent` ❌ | Lightweight wrapper for `/error/*` pages | Forbidden / server-error / offline / not-found |

**AppShell composition:**
- `SidebarNavComponent` — nav tree built from `ROUTE_METADATA` (see §5.2), collapsible, keyboard-navigable.
- `TopHeaderComponent` — user menu, theme toggle, notifications bell.
- `TopNavbarComponent` — alternative horizontal navigation (user-selectable via `LayoutStore`).
- `<p-toast>` — single global toast host.
- `<p-confirmdialog>` — single global confirm host.
- `<router-outlet name="drawer">` ❌ — secondary outlet for side-drawer routes.

### 5.2 Routing

**Top-level** (`app.routes.ts`):

```
/auth                (AuthLayout)
  /login             (LoginComponent)

/                    (AppShell, canActivate: [authGuard])
  /dashboard         (permission: dashboard:read)
  /users             (loadChildren: USERS_ROUTES)
  /<feature>         (loadChildren per aggregate)
  /settings          (permission: settings:read)

/error               (ErrorLayout)
  /forbidden         (403)
  /server-error      (500)
  /offline           (network)
  /maintenance       (scheduled)

**                   (404 NotFoundComponent)
```

**Route metadata pattern.** Each route declares its `data` — nav metadata
consumed by `SidebarNavComponent`, breadcrumbs, and guards:

```ts
{
  path: 'users',
  data: {
    label: 'Users',
    icon: 'pi-users',
    breadcrumb: 'Users',
    requiredPermissions: ['users:read'],
    featureFlag: 'users.enabled',
    showInNav: true
  } satisfies RouteMetadata,
  canActivate: [authGuard, permissionGuard('users:read')],
  loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES),
}
```

**Breadcrumb resolution.** A `breadcrumbResolver` walks `ActivatedRouteSnapshot`
→ root, accumulates `data.breadcrumb` (static or function of params), emits
`BreadcrumbItem[]` to `PageHeaderComponent` via a shared signal.

**UI-Kit route exclusion.** The 21-route PrimeNG showcase is:
- Gated by `environment.features.showUiKit` + `environment.production === false`.
- Lazy-loaded and tree-shaken when the flag is off (dynamic import inside a
  feature-flag guard returns a `NotFoundComponent`).

### 5.3 Shared UI primitives

**Components** (`shared/components/*`):

| Component | Wraps / purpose | Notes |
|---|---|---|
| `DataTableComponent` | Generic paginated table (`p-table`) | Column-config-driven, type-aware cells, action cells |
| `PageHeaderComponent` | Title / breadcrumbs / action buttons | Breadcrumbs from route data |
| `DetailViewComponent` | Label/value read-only grid | Used in entity detail views |
| `DrawerPanelComponent` | Side panel for inline forms (`p-drawer`) | Target: also via secondary outlet |
| `ConfirmDialogComponent` | PrimeNG confirm wrapper | **Target:** deprecate in favor of `ConfirmationService` only |
| `StepperFormComponent` | Multi-step form (wraps `DynamicPageComponent`) | Shares `FormGroup` with dynamic form |
| `ChartWidgetComponent` | `p-chart` + chart.js | **Target:** chart.js loaded only from this component (lazy partition) |
| `StatCardComponent` | KPI card (value + trend) | |
| `StatusBadgeComponent` | Severity-mapped pill (`p-badge`) | Status enum → color map |
| `TimelineComponent` | Vertical/horizontal timeline (`p-timeline`) | |
| `EmptyStateComponent` | No-data UX | Accepts CTA button |
| `ErrorStateComponent` | HTTP-error UX | Accepts retry callback |
| `LoadingOverlayComponent` | Local/global spinner | |
| `GlobalProgressBarComponent` | Top-of-viewport bar driven by `LoadingService` | |
| `SkeletonCardComponent` ❌ | Inline skeleton (card / list-row / chart variants) | Target: Phase 5 |
| `VirtualListComponent` ❌ | `cdk-virtual-scroll` wrapper | Target: for very long client-side lists |
| `FilePreviewComponent` ❌ | PDF / image / Office preview | Target: content-type aware renderer |
| `CommandPaletteComponent` ❌ | ⌘K launcher — searches routes + entities | Target: Phase 5 |

**Directives:**
- `*appHasRole="'admin'"`, `*appHasPermission="'p'"`, `*appHasAnyPermission="[...]"`
- `appAutofocus` — focus on view init (a11y compliant, configurable delay)
- `appTrapFocus` ❌ — focus-trap container for modals/drawers (replaces PrimeNG's default where missing)
- `appCopyToClipboard="value"` ❌ — copy + toast feedback

**Pipes:**
- `relativeTime` — date-fns `formatDistanceToNow`
- `truncate:n[:suffix]` — ellipsis after N chars
- `safeHtml` ❌ — DOMPurify-sanitized innerHTML binding
- `currency2` ❌ — locale-aware currency with ISO-4217-to-symbol map
- `fileSize` ❌ — `KB`/`MB`/`GB` humanization

### 5.4 Design tokens + styling

**Layer order** (`config/primeng.config.ts`):
`tailwind-base  ≻  primeng  ≻  tailwind-utilities`

**Token files** (`src/styles/*.css`):

| File | Content |
|---|---|
| `tokens.css` | CSS custom properties — z-index scale, transitions, easing, content widths, sidebar/header dimensions, backdrop blur |
| `typography.css` | Font stack, size scale, line-height scale |
| `animations.css` | Keyframes — fade, slide, scale |
| `scrollbars.css` | Webkit-scrollbar tweaks |
| `utilities.css` | Project-specific utilities not covered by Tailwind |
| `primeng-overrides.css` | ⚠️ ~70KB; needs pruning + re-expressing as theme preset where possible |

**PrimeNG theme** (`config/theme.config.ts`):
- Extends Aura preset.
- Primary palette = extended blue (50–950).
- Component-level tokens: `Card.borderRadius=xl`, `Dialog.borderRadius=xl`, `Tag/Badge/Chip.borderRadius=pill`.
- Dark-mode selector: `.dark` on `<html>` (toggled by `ThemeService`).

**Tokens export** (❌ Phase 5): tokens.css → Tailwind `theme.extend.colors` via
`@theme` inline or generated map — one source-of-truth for palettes, spacings,
radii.

**Responsive matrix.** Every shared component ships a Storybook story
rendering at `xs / sm / md / lg / xl / 2xl` breakpoints. Visual regression
checks (Chromatic / Playwright) catch unintended responsive drift. ❌ Phase 5.

### 5.5 Dynamic form subsystem

Schema hierarchy (unchanged from current):

```
PageConfig
 ├─ header: PageHeaderConfig (title / subtitle / breadcrumbs / actions / icon)
 ├─ sections: SectionConfig[]
 │   ├─ container: 'none'|'panel'|'fieldset'|'card'|'accordion'|'tabs'|'stepper'|'splitter'
 │   ├─ rows: RowConfig[] → fields: FieldConfig[]   ← 22 discriminated types
 │   ├─ children: SectionConfig[]                    ← nested containers
 │   └─ table?: SectionTableConfig                   ← embedded DataTable
 ├─ actions: ActionConfig[]
 └─ crossFieldValidators: CrossFieldValidator[]
```

**Services** (`shared/components/dynamic-form/services/`):

| Service | Role |
|---|---|
| `FormBuilderService` | `buildFormGroup(config, initialData?)` → `FormGroup` |
| `ValidationMapperService` | `FieldValidator` config → `ValidatorFn[]` / `AsyncValidatorFn[]` |
| `FieldVisibilityService` | Evaluates `visibleWhen` / `disabledWhen` per field |
| `ServerErrorMapperService` ❌ | Projects `ApiError.errors` (per-field 422) onto `FormControl.errors` |
| `FormAutosaveService` ❌ | Optional autosave-to-localStorage per form id; restores on mount |
| `ZodAdapterService` ❌ | `ZodSchema` → `FieldConfig[]` + `ValidatorFn[]` — aligns client validation with backend Zod schemas |

**Target field-level enhancements:**
- ❌ Per-field async validator exemplars (e.g. `emailUnique`, `usernameAvailable`) with debounce + cancellation.
- ❌ Conditional required (`requiredWhen`) as a first-class option.
- ❌ Repeatable field groups (array forms) with add/remove/reorder — current
  schema has no explicit array-field kind.

**Codegen story.** A feature's form is generated from the backend DTO's Zod
schema (or OpenAPI fragment) at build time. Output is a `PageConfig` TypeScript
module. Handwritten deltas live alongside in a `*.overrides.ts` file.

### 5.6 Accessibility baseline (❌ Phase 5)

Every shared component must meet:
- **Keyboard.** All actions reachable; tab order preserves visual order; focus-trap inside modals/drawers; ESC closes dismissibles; Enter activates primary action.
- **ARIA.** `aria-label` on icon-only buttons; `aria-live` on toast host and loading bar; `aria-describedby` wiring for form errors; `role="dialog" aria-modal="true"` on modals.
- **Contrast.** WCAG AA minimum (4.5:1 body, 3:1 large text) — verified in Storybook axe checks.
- **Reduced motion.** `prefers-reduced-motion` honored in `animations.css`.
- **Screen-reader verification** in CI via `@axe-core/playwright` on every merged PR.

---

## Part VI — Observability

### 6.1 Telemetry

| Channel | Target product | Notes |
|---|---|---|
| Errors | Sentry / App Insights (pluggable) | Capture uncaught errors, unhandled promise rejections, Angular `ErrorHandler` dispatches, router navigation failures |
| Web vitals | Same | LCP / INP / CLS / TTFB / FCP via `web-vitals` lib; sampled to telemetry endpoint |
| Traces | OTEL-web exporter to OTLP collector | Spans: navigation, XHR, long-task; correlated with backend via `traceparent` |
| Metrics | Same | Per-route page-view counter, handler duration, cache-hit rate |
| Logs | `LoggerService` → telemetry sink in prod; console in dev | Structured; PII-scrubbed before emit |

**Initialization.** A `provideAppInitializer(initTelemetry)` reads the runtime
config (`sentryDsn`, `otlpUrl`, `environment`, `release`) and initializes the
SDKs before the router emits its first navigation.

**Release correlation.** `environment.buildStamp` populates Sentry `release`
and App Insights `cloud_RoleInstance`, letting ops tie errors to the exact
commit.

**PII scrubbing.** `LoggerService.scrub()` applies the same redaction rules as
the backend's `PiiScrubber`:
- Email, phone, SSN/ITIN, credit-card-like patterns → `<redacted>`.
- Field names in an allowlist (`firstName`, `lastName`, `dob`, `ssn`,
  `creditCardNumber`, `address`) in any object → `<redacted>`.

### 6.2 Correlation IDs

- `correlationInterceptor` generates a per-request UUID (or propagates an
  ambient one from an outer navigation span) and attaches `X-Correlation-ID`.
- Frontend logger decorates every structured log with the active correlation
  ID.
- Backend's structured logger already emits correlation; the chain becomes
  traceable end-to-end.

### 6.3 Error boundaries

- **Global.** `GlobalErrorHandlerService implements ErrorHandler` — reports
  to telemetry, shows a toast, redirects to `/error/server-error` on fatal.
- **Route-level.** `RouterErrorBoundaryComponent` ❌ — wraps a feature's
  `<router-outlet>`, catches render-time errors, displays `ErrorStateComponent`
  with a retry that re-navigates to the same URL.

### 6.4 User-facing failure UX

| Condition | UI |
|---|---|
| Network offline | Inline "You are offline" banner at the top (driven by `navigator.onLine` store) |
| 401 after silent refresh failed | Toast "Session expired, please sign in" → `/auth/login?returnUrl=...` |
| 403 | Toast "Access denied" → `/error/forbidden` |
| 404 on direct nav | `/error/not-found` component with nav-to-home CTA |
| 409 (concurrency) | Toast "Record changed — refresh?" with "Refresh" button (refetches) |
| 422 (validation) | Errors projected onto `FormControl.errors` + inline field messages |
| 5xx | Toast + telemetry + retry button |

---

## Part VII — Internationalization & Localization (optional, Phase 8)

If the product serves non-English users:

- **Library.** `@angular/localize` (runtime translation API) + ICU message
  format. `ngx-translate` alternatives are considered legacy.
- **Catalogue.** Messages extracted via `ng extract-i18n`; translated catalogs
  in `src/locale/<lang>.xlf`; build produces per-locale bundles.
- **Locale store.** `LocaleStore` (root signalStore) holds current locale,
  reads from `localStorage` preference, falls back to `navigator.language`.
  `LOCALE_ID` token bound to this signal.
- **Date/number.** `date-fns/locale/*` dynamically imported per locale.
- **RTL.** Tailwind v4 `dir-rtl:` variants; PrimeNG `dir="rtl"` applied at
  `<html>` in RTL locales.
- **Timezone.** User prefs store chosen TZ (defaults to `Intl.DateTimeFormat().resolvedOptions().timeZone`);
  every date pipe uses `formatInTimeZone(date, tz, fmt)`. UTC-only storage on
  the wire.

---

## Part VIII — Testing Strategy

### 8.1 Pyramid

```
   ─────────────── E2E (Playwright) ─────────────── ~30 specs
   ─────────── Component (TestBed + harnesses) ──── ~100 specs
   ──────── Unit (Vitest) — services/stores/utils ── ~300 specs
          │
          ▼
   Type-check (tsc --noEmit)  +  arch tests (dependency-cruiser)
```

### 8.2 Unit — Vitest + jsdom

Required specs (current: **1**; target: ~300):

| Subject | Key cases |
|---|---|
| `createEntityStore` | loadAll success / error / cancels prior / sets pagination / sets queryParams / create/update/delete mutate state / loadAllIfStale respects TTL / devtools wires |
| Each `with-*.feature` | isolated state shape + setter methods |
| `BaseApiService` | URL building / HttpParams serialization / If-Match header on update/patch |
| Interceptors | each in isolation — retry backoff / 401 skip / error normalization / opt-out headers respected / loading counter balanced / correlation id generation |
| Guards | authenticated / unauthenticated / permission match / resource-ownership |
| `AuthService` | signal updates on InteractionStatus.None / logout broadcasts / token acquisition failure path |
| `FormBuilderService` | config → FormGroup / cross-field validators / disabledWhen reactivity / initialData patched |
| `ValidationMapperService` | each built-in validator type maps correctly / custom validators passed through / async validators |
| `ServerErrorMapperService` | 422 errors projected onto right FormControls / nested fields / cleared on next submit |
| All pipes | |

### 8.3 Component — `@angular/cdk/testing` harnesses

Target ~100 specs. Each shared primitive (DataTable, PageHeader, DynamicField,
every dynamic-form control) gets a harness-based spec covering render, input
validation, user interaction.

### 8.4 Architecture tests — dependency-cruiser

Rules enforced in CI (mirrors backend NetArchTest):
- `core/*` must not import from `features/*` or `layouts/*`.
- `shared/*` must not import from `core/services/*`, `features/*`, `layouts/*`.
- `features/A/*` must not import from `features/B/*`.
- No runtime import from `@env/environment` outside `config/` and `core/services/*`.

### 8.5 E2E — Playwright

Target ~30 specs covering:
- Login (MSAL dev stub) → dashboard.
- Users CRUD end-to-end.
- Permission-denied redirect.
- Unsaved-changes prompt.
- Keyboard-only navigation of AppShell.
- Toast lifecycle (error / success / stacking).
- Session-expiry modal.

### 8.6 Visual regression + a11y

- **Storybook** — every shared primitive and dynamic-form control in every
  state.
- **Chromatic** (or Playwright screenshots) — visual diff on each PR.
- **axe** — `@axe-core/playwright` + Storybook test-runner a11y addon. Zero
  violations is the merge gate.

### 8.7 Coverage gates

| Layer | Minimum |
|---|---|
| `core/` | 90% lines / 80% branches |
| `shared/` | 80% / 70% |
| `features/` | 60% / 50% |
| Global | 70% / 60% |

Reports merged via `coverlet`-equivalent (`vitest --coverage` → v8 istanbul →
Codecov / GitHub Checks).

---

## Part IX — Build, CI, Performance

### 9.1 Build

- **Builder:** `@angular/build:application` (esbuild).
- **Production budgets:**
  - Initial: 1 MB warn / 2 MB error (baseline today; re-evaluate per feature growth).
  - Any component style: 4 KB / 8 KB.
  - Any lazy chunk: 500 KB / 1 MB.
  - LCP budget: ≤ 2.5 s on 4G.
  - INP budget: ≤ 200 ms.
- **Output hashing:** enabled (immutable cache-friendly).
- **Source maps:** enabled in production (uploaded to Sentry only, not shipped to `/dist`).
- **SBOM:** CycloneDX SBOM generated on every build; uploaded to release artifacts.

### 9.2 Preloading

`withPreloading(CustomPreloader)` — preloads routes tagged
`data.preload: true` after the initial navigation is idle. Examples: dashboard
preloads, UI-kit doesn't.

### 9.3 Lazy partitioning for heavy deps

| Dependency | Kept in | Loaded from |
|---|---|---|
| `chart.js` | `ChartWidgetComponent` only | `chart-widget.component.ts` dynamic import |
| Full PrimeNG surface | Broken up — each shared component imports only the PrimeNG modules it uses | — |
| Heavy date-fns locales | `LocaleStore` dynamic import by current locale | — |
| `zod` | `shared/dynamic-form/services/zod-adapter.service.ts` only | — |
| Rich-text editor (future) | Its own feature lazy route | — |

### 9.4 Image optimization

- `NgOptimizedImage` used for every static asset > 20 KB.
- `priority` hint on hero images.
- Responsive `srcset` generated by image pipeline (build plugin).

### 9.5 SSR / SSG (optional, Phase 10)

If SEO or TTFB matters:
- `@angular/ssr` in hybrid mode.
- MSAL does not support SSR natively; auth guards short-circuit to client-only
  on the server (emit skeleton, hydrate on client).
- Per-route `providerConfig` decides SSR vs CSR vs SSG.

---

## Part X — Developer Experience

### 10.1 Tooling baseline (❌ mostly missing today)

| Tool | Role | Status |
|---|---|---|
| TypeScript strict mode | Compile-time guarantees | ✅ configured |
| Prettier | Formatting | ✅ `.prettierrc` committed |
| ESLint | Linting + custom architecture rules | ❌ Phase 1 |
| `import/no-restricted-paths` | Tier-boundary enforcement | ❌ Phase 1 |
| `eslint-plugin-security` + `no-secrets` | Security lint | ❌ Phase 1 |
| `dependency-cruiser` | Architecture tests in CI | ❌ Phase 4 |
| Husky + lint-staged | Pre-commit hook — lint, format, test:affected | ❌ Phase 1 |
| `commitlint` + Conventional Commits | Commit-message enforcement | ❌ Phase 1 |
| Storybook | Component catalogue + a11y | ❌ Phase 5 |
| Chromatic / Playwright screenshots | Visual regression | ❌ Phase 5 |
| Angular schematics | `ng g feature-slice <name>` → generates model + api service + store + routes + CRUD components | ❌ Phase 6 |

### 10.2 Repo docs

- `README.md` — quickstart, stack, env setup, dev proxy.
- `CONTRIBUTING.md` ❌ — branch / PR / commit rules, local setup, testing expectations.
- `Docs/Architecture/UI-Architecture.md` — this document.
- `Docs/Review/UI-Deep-Review-*.md` — periodic state snapshots.
- `Docs/Implementation/UI-Foundation-TODO.md` — phased backlog.
- Per-feature `README.md` ❌ — optional, for non-trivial slices.

### 10.3 Feature scaffold (target)

`nx g feature-slice users` or equivalent Angular schematic produces:

```
src/app/features/users/
├── models/
│   └── user.model.ts                     // UserEntity extends BaseEntity
├── services/
│   └── users-api.service.ts              // extends BaseApiService<UserEntity>
├── store/
│   ├── index.ts
│   └── users.store.ts                    // createEntityStore<UserEntity>
├── components/
│   ├── users-list/users-list.component.ts
│   ├── user-detail/user-detail.component.ts
│   └── user-form/user-form.component.ts
├── users.routes.ts
└── index.ts                              // barrel
```

…plus a starter Storybook story per component and a unit-test stub per
service/store.

---

## Part XI — Deployment & Ops

### 11.1 Environments

| Env | `production` flag | API | MSAL | Telemetry |
|---|---|---|---|---|
| `environment.ts` (local dev) | false | `http://localhost:5000/api/v1` | Dev App Registration | Disabled |
| `environment.staging.ts` | false / `staging: true` | `https://staging-api.*` | Staging App Registration | Enabled |
| `environment.production.ts` | true | `https://api.*` | Prod App Registration | Enabled |

**All three files currently hold placeholder MSAL GUIDs — must be replaced
before first deployment (Phase 2).**

### 11.2 Feature flags

| Source | Role | Consumer |
|---|---|---|
| `environment.features.*` | Compile-time flags — disable a subsystem entirely (e.g. `showUiKit: false` strips the showcase) | Tree-shaken constants |
| `RUNTIME_CONFIG.features.*` | Runtime flags — per-deployment switches (e.g. beta features, A/B gates) | `FeatureFlagService.isEnabled(flag)` signal |
| `LaunchDarkly / ConfigCat / Unleash` (optional) | User-targeted flags | Client SDK pulled via feature-flag service |

### 11.3 Hosting options

| Option | When to choose |
|---|---|
| **BFF host (Enterprise.Platform.Web.UI)** | **Default since Phase 9.** Cookie-session auth, per-request CSP nonces, request proxy to API with server-side token acquisition. The browser sees only the BFF's origin. |
| ~~Static host (Azure Static Web Apps, Cloudflare Pages, S3+CloudFront)~~ | ~~MSAL-direct SPA without BFF.~~ Retired with Phase 9 — the SPA no longer ships an OIDC client. |
| ~~Hybrid~~ | ~~Initial bootstrap via BFF; subsequent calls direct to API.~~ Retired with Phase 9. |

### 11.4 CDN + caching

- `index.html` — `cache-control: no-store` (must revalidate each load so new
  build stamps land immediately).
- Hashed JS/CSS — `cache-control: public, max-age=31536000, immutable`.
- `/config.json` — `cache-control: no-cache` (must revalidate; content
  changes per-deployment).
- Static assets (images, fonts) — `max-age=604800` with content hashing.

---

## Part XII — Conventions

- **Standalone everywhere.** No NgModule.
- **`ChangeDetectionStrategy.OnPush` on every component.** Zoneless demands it.
- **Signals for state.** No `BehaviorSubject` in components/services unless
  bridging to RxJS APIs.
- **Functional DI** — `inject(...)` over constructor parameters (except where
  Angular requires the `constructor()`).
- **Functional guards/interceptors.** Class-based only for library constraints.
- **Barrel exports.** Every tier has an `index.ts` for ergonomic imports.
- **Route-scoped feature stores.** `providedIn: null` + `providers: [FooStore]`.
- **One owner per concern.** Error toasts → interceptor. Loading bar →
  loading service. Auth state → AuthService. Tenant → TenantService.
- **Explicit visibility.** `private readonly` on `inject()` captures.
  `readonly` on signal fields.
- **PII-safe logging.** Never log raw entities from `core/models/*`; always
  pass through `logger.scrub(obj)`.
- **Correlation.** Every outbound request carries an ID; every structured log
  emits it.
- **No magic strings in auth.** Permission/role names live in a
  `Permissions.ts` / `Roles.ts` constant map.
- **Strings are locale-keys, not literals,** in any feature intended for
  i18n (Phase 8).

---

## Part XIII — Data-flow cheat sheet

**Read:**
```
Component template
  @if (store.loading()) { <SkeletonCard/> }
  @else { @for (u of store.allEntities(); track u.id) { … } }
       ↑ signal subscription; zoneless CD re-renders on write
Store (signalStore)
  loadAllIfStale() → (consults lastLoadedAt + CACHE_TTL_MS)
    ↓ stale → loadAll()
      ↓ rxMethod → switchMap → apiService.getAll(params)
HttpClient → interceptor chain → network
  ↑ correlation / tenant / XSRF / cache / dedup / loading / logging / retry / error
Response → tapResponse → patchState({ ids, entities, total, lastLoadedAt: now(), isStale: false })
```

**Write (optimistic):**
```
Component (button click)
  → store.updateEntity({ id, changes })
    → snapshot = store.entities()[id]
    → patchState({ entities: { …, [id]: { …snapshot, …changes } }, saving: true })  // optimistic
    → apiService.update(id, changes)  // sends If-Match: <version>
      → tapResponse:
          success → patchState({ entities: { …, [id]: server }, saving: false })
          error   → patchState({ entities: { …, [id]: snapshot }, saving: false, error })  // rollback
```

**Error-toast ownership:**
```
network → errorInterceptor
  ├─ normalize to ApiError
  ├─ toast by status (403 / 409 / 422 / 5xx)
  ├─ navigate for 403 (forbidden) / 401-unrecoverable (auth/login)
  └─ rethrow (store captures into error() signal for inline display only)
```

---

## Part XIV — File map (critical paths)

| Concern | Path |
|---|---|
| Bootstrap | `src/main.ts` |
| Root component | `src/app/app.ts` |
| Provider graph | `src/app/config/app.config.ts` |
| Runtime config loader | `src/app/config/runtime-config.ts` ❌ |
| PrimeNG preset | `src/app/config/theme.config.ts` |
| PrimeNG runtime | `src/app/config/primeng.config.ts` |
| MSAL factories | `src/app/config/msal.config.ts` |
| Top-level routes | `src/app/app.routes.ts` |
| Route metadata types | `src/app/core/routing/route-metadata.ts` ❌ |
| Auth service | `src/app/core/auth/auth.service.ts` |
| Auth store (permissions hydration) | `src/app/core/auth/auth.store.ts` ❌ |
| Guards | `src/app/core/guards/{auth,permission,role,ownership,feature-flag,unsaved-changes}.guard.ts` |
| HTTP base | `src/app/core/http/base-api.service.ts` |
| API contracts | `src/app/core/models/{api-response,auth,entity,query-params,ui,route-metadata}.model.ts` |
| Interceptors | `src/app/core/interceptors/{correlation,tenant,security,cache,dedup,loading,logging,retry,error}.interceptor.ts` |
| Feature-flag service | `src/app/core/services/feature-flag.service.ts` ❌ |
| Logger + PII scrub | `src/app/core/services/logger.service.ts` |
| Telemetry init | `src/app/core/services/telemetry.service.ts` ❌ |
| Base store factory | `src/app/core/store/base/base-entity.store.ts` |
| Store features | `src/app/core/store/base/store-features/with-*.feature.ts` |
| Cache invalidation bus | `src/app/core/store/cache-invalidation.bus.ts` ❌ |
| Dynamic-form schema | `src/app/shared/components/dynamic-form/models/*.model.ts` |
| Dynamic-form services | `src/app/shared/components/dynamic-form/services/*.service.ts` |
| Dynamic-form controls | `src/app/shared/components/dynamic-form/components/dynamic-field/controls/*.component.ts` |
| DataTable | `src/app/shared/components/data-table/data-table.component.ts` |
| AppShell | `src/app/layouts/app-shell/app-shell.component.ts` |
| AuthLayout | `src/app/layouts/auth-layout/auth-layout.component.ts` |
| ErrorLayout | `src/app/layouts/error-layout/error-layout.component.ts` ❌ |
| Exemplar feature slice | `src/app/features/users/**` |
| Storybook root | `.storybook/` ❌ |
| Playwright root | `e2e/` ❌ |

❌ = target-state path that does not yet exist.

---

## Part XV — Architecture decisions log (ADR-lite)

| # | Decision | Why | Alternatives considered | Status |
|---|---|---|---|---|
| 1 | Zoneless change detection | Smaller bundle, simpler mental model, mandatory for perf-critical apps | Keep Zone.js | ✅ locked |
| 2 | NGRX Signals over classic NgRx | Less ceremony per feature; signals-native; `createEntityStore` is 40 lines instead of 500 | NgRx Store + effects + selectors; Akita | ✅ locked |
| 3 | BFF cookie-session (Phase 9) | Closes XSS token-exposure window; eliminates CORS; SPA bundle drops `@azure/msal-*` (~150 kB). MSAL-direct path retired 2026-04-21 | BFF-only from start; MSAL-direct kept; hybrid (initial via BFF, subsequent direct) | ✅ BFF cookie-session — Phase 9 closed |
| 4 | PrimeNG + Tailwind v4 | Comprehensive widget library + utility-first styling; CSS layers make cohabitation clean | Angular Material only; custom-built | ✅ locked |
| 5 | `errorInterceptor` owns HTTP-error toasts | Single owner; no double-fire; stores focus on state, not UX | Store-owned; per-call toast | ✅ locked |
| 6 | Runtime config via `/config.json` | Env changes without rebuild; needed for container deployments | Build-time `environment.ts` only | ⚠️ target (Phase 2) |
| 7 | Permissions hydrated from API, not roles | Real RBAC vs. misleading alias | Keep permissions = roles | ⚠️ target (Phase 1) |
| 8 | Schema-driven forms w/ Zod adapter | Cross-tier validation parity; one source of truth | Hand-written form configs | ⚠️ adapter = Phase 6 |
| 9 | Route-scoped feature stores | Memory discipline; store dies with route | Root-scoped per feature | ✅ locked |
| 10 | Strict ESLint architecture tests in CI | Prevents tier violations | Manual review only | ⚠️ target (Phase 1+4) |

---

## Part XVI — Intentional non-goals (for now)

- **Server-side rendering.** Client-only; add `@angular/ssr` if SEO becomes relevant.
- **Offline-first / PWA.** No service worker today; opt in per-domain in Phase 10 if needed.
- **Nx monorepo.** Single app; migrate to Nx if the frontend grows to > 3 apps.
- **GraphQL / gRPC-web.** REST + OpenAPI is the contract today.
- **Plugin runtime.** No runtime-loaded plugin system; extensions land via a new feature slice.

---

## Part XVII — Companion documents

- Current-state audit: [`../Review/UI-Deep-Review-2026-04-20.md`](../Review/UI-Deep-Review-2026-04-20.md)
- Phased roadmap to architecture-compliance: [`../Implementation/UI-Foundation-TODO.md`](../Implementation/UI-Foundation-TODO.md)
- Backend counterpart: [`./01-Enterprise-Architecture-Overview.md`](./01-Enterprise-Architecture-Overview.md)
