# 01 — Loading Sequence

What happens between **"user types `/dashboard` and presses Enter"** and **"user sees their data"** in this app, in the order it actually happens.

This doc reflects the codebase **as it exists today**. The "Future enhancements" section at the end notes deliberately-unimplemented patterns from external best-practice prompts.

---

## Phase 0 — Pre-flight (network)

Before Angular knows anything: DNS → TCP → TLS → HTTP `GET /` → server returns `index.html`. With HTTP/2 (Kestrel default), the same TCP+TLS connection serves every subsequent JS chunk, CSS, and `/api/proxy/*` request — handshake cost is paid once.

The BFF pattern means Angular always talks to the same origin (`http://localhost:5001` in dev). Zero CORS preflight, zero token leakage to JavaScript — auth rides as an HttpOnly cookie set by the OIDC callback.

---

## Phase 1 — Resource loading (parallel)

Browser parses `index.html` and dispatches:

- **`styles.HASH.css`** — render-blocking. Tailwind v4 + tokens.css + PrimeIcons font + animations + per-component encapsulated CSS.
- **`main.HASH.js`** — `type="module"`, deferred. Contains Angular core + Router + HttpClient + RxJS + PrimeNG core + `app.config.ts` + `AppComponent` + `AppShellComponent` + every interceptor.
- **`polyfills.HASH.js`** — small. Zone.js is **NOT** in here (we run zoneless).

Index.html also preconnects to Google Fonts (Noto Sans). Other than that, no third-party origins.

---

## Phase 2 — Bootstrap (`main.ts`)

```ts
// src/main.ts
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

`bootstrapApplication()` creates the root `EnvironmentInjector`, processes every provider in `appConfig`, instantiates `App`, and mounts it on `<app-root>`.

### Provider order (from `src/app/config/app.config.ts`)

The order matters — providers run in registration order, downstream providers may inject upstream ones.

| # | Provider | Purpose |
|---|---|---|
| 1 | `provideBrowserGlobalErrorListeners()` | Catches uncaught JS errors → Angular's default ErrorHandler |
| 2 | `provideZonelessChangeDetection()` | Disables zone.js. Signals are the only CD trigger |
| 3 | `provideRouter(routes, ...)` | Router with `withComponentInputBinding`, `withViewTransitions`, `withRouterConfig({ onSameUrlNavigation: 'reload' })`, `withPreloading(CustomPreloader)`, `withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })` |
| 4 | `provideHttpClient(withXsrfConfiguration, withInterceptors([8 interceptors]))` | HTTP with XSRF cookie/header pair + the chain (see below) |
| 5 | `provideAnimationsAsync()` | PrimeNG overlays use the animations module, lazy-loaded |
| 6 | `providePrimeNG(primeNgConfig)` | Aura preset + brand-tinted primary palette + `cssLayer.order: 'theme, base, primeng, utilities'` |
| 7 | `MessageService`, `ConfirmationService`, `DialogService` | PrimeNG service singletons |
| 8 | `provideAppInitializer(loadRuntimeConfig)` | `GET /config.json` → populates `RUNTIME_CONFIG` (API base URL, telemetry sink) |
| 9 | `provideAppInitializer(AuthService.refreshSession)` | `GET /api/auth/session` — primes the `isAuthenticated` signal so the first render knows session state |
| 10 | `provideAppInitializer(CspViolationReporterService.register)` | Subscribes to the `securitypolicyviolation` DOM event |
| 11 | `provideAppInitializer(FocusManagementService.init)` | Subscribes to `NavigationEnd` → `<main>.focus({ preventScroll: true })` for screen readers (WCAG 2.4.3) |
| 12 | `{ provide: LOCALE_ID, useValue: 'en-US' }` | Default locale for Intl APIs |

### HTTP interceptor chain (request order)

```
correlation → security → cache → dedup → loading → logging → retry → error
```

- **correlation** mints/echoes `X-Correlation-ID`
- **security** reads `XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header for same-origin `/api/*`
- **cache** + **dedup** are GET-only optimizations
- **loading** drives the global progress bar
- **logging** emits structured request/response logs
- **retry** transient-fault retry on idempotent verbs
- **error** normalizes 4xx/5xx + redirects on 401/403

**No tenant interceptor** — single-tenant since Phase 1.

---

## Phase 3 — APP_INITIALIZER chain

Four async-tolerant initializers run sequentially. Angular awaits all of them before activating any route.

| Initializer | Sync/async | Typical duration |
|---|---|---|
| `loadRuntimeConfig()` | async (fetch `/config.json`) | 5–50 ms (cached after first run) |
| `AuthService.refreshSession()` | async (fetch `/api/auth/session`, network-tolerant) | 50–300 ms |
| `CspViolationReporterService.register()` | sync | <1 ms |
| `FocusManagementService.init()` | sync (subscribes to router events) | <1 ms |

`refreshSession` is wrapped to swallow its own failures — a network blip on session probe shouldn't hang the app. If 401s surface later from real API calls, the error interceptor handles the redirect.

**The user sees nothing during this phase** — `<app-root>` is empty until route activation completes. On a normal connection this is well under 500 ms.

---

## Phase 4 — Router activation (first navigation)

The router resolves the URL (`/dashboard`) against `app.routes.ts`. The matching tree:

```
'' (auth-protected, lazy AppShellComponent, [authGuard])
├── 'dashboard' (lazy DashboardComponent, data.preload: true)
├── 'users' (lazy USERS_ROUTES, providers: [UsersStore])
├── 'demo/sub-nav' (temporary)
└── '**' (lazy NotFoundComponent — in-shell 404 with header)
```

For `/dashboard`:

1. **`authGuard`** (functional, sync) — `if (auth.isAuthenticated()) return true; else router.createUrlTree(['/auth/login'], { queryParams: { returnUrl } })`. Pure signal read; zero network.
2. **AppShellComponent chunk** loads (small — sub-nav orchestrator + status banner host + page header + footer).
3. **DashboardComponent chunk** loads. With `data.preload: true` + `CustomPreloader`, this chunk is fetched in the background while the user is still on `/auth/login`, so the cold path on first visit pays it but every subsequent route change is instant.

---

## Phase 5 — Component rendering

```
<app-root>
  └── <app-app-shell>
       ├── <app-global-progress-bar>
       ├── <app-platform-navbar>           ← sticky, z-index 30
       ├── <app-sub-nav-orchestrator>      ← status banners + breadcrumb + page header
       ├── <main id="main-content">        ← document scroll target
       │    └── <router-outlet>            ← DashboardComponent renders here
       │    └── <app-platform-footer>
       ├── <p-toast position="top-right">
       ├── <p-confirmdialog>
       └── @defer (when session.expiringSoon())
            <app-session-expiring-dialog>
</app-root>
```

This is **First Contentful Paint** — navbar + breadcrumb + page-header skeleton are visible. Page-header pulls its config from `route.data.pageHeader` (or `PageHeaderService.config()` if a page set it dynamically).

---

## Phase 6 — Data calls

Page components fire HTTP calls (typically in `ngOnInit` or via store `loadX()` methods). For the Users feature this means `UsersStore.loadList()` → `UsersApiService.list(params)` → the interceptor chain → BFF → backend → response → Zod parse → `patchState` → view re-renders.

Because we're zoneless, only the components whose signals changed re-render — not the whole tree.

---

## Total cost on a warm browser

| Phase | Typical |
|---|---|
| Phase 0 (network) | 0 ms (HTTP/2 keep-alive) |
| Phase 1 (resource fetch from cache) | 10–30 ms |
| Phase 2 (bootstrap) | 50–100 ms |
| Phase 3 (initializers) | 100–400 ms (dominated by session probe) |
| Phase 4 (router + lazy chunk) | 0–20 ms (preloaded) |
| Phase 5 (first render) | 30–80 ms |
| Phase 6 (first API response) | 50–500 ms (network + backend) |
| **Total to first useful pixel** | **~250–1000 ms warm, ~1500–3000 ms cold** |

---

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| White screen forever | An app initializer hung (network unreachable, no timeout) | Wrap async initializers in `timeout(N) + catchError(...)`. `loadRuntimeConfig` already does this; verify any new initializer follows the same pattern |
| White screen + console error | An initializer threw synchronously | Wrap initializer body in try/catch; fall back to a sensible default |
| First render flashes wrong theme | Theme service ran AFTER first render | Theme is set in the service constructor (sync); double-check the import path is included in `app.config.ts`'s provider graph |
| Skip-link doesn't take focus | `<main>` missing `tabindex="-1"` | We set this on `<main>` in `app-shell.component.ts` |
| 401 loop on app open | Session probe returned 401, error interceptor redirected, login redirected back | Check BFF cookie domain/path; cookie not being sent |
| Route works in dev, 404 in prod | Static-file server doesn't fall back to `index.html` | Configure SPA fallback in nginx/IIS (not an Angular issue) |

---

## Future enhancements (deliberately unimplemented)

These appear in external "best-practice" prompts but are NOT in our app today. Each will be added when a real feature drives the need:

- **`TenantService` + tenant interceptor** — single-tenant since Phase 1, no consumer
- **`FeatureFlagService.load()` initializer** — no feature flags in active use
- **`QuicklinkStrategy` preloader** — `CustomPreloader` (opt-in via `data.preload: true`) is sufficient and more conservative
- **`ViewportService` (sets `--app-height`)** — `100dvh` is supported on every browser we target (Chrome 108+, Firefox 101+, Safari 15.4+)
- **`resource()` API for dashboard widgets** — current Dashboard uses `HttpClient` + signals directly; revisit when a feature has 5+ parallel resources

See `Architecture/UI-Standards-Triage.md` for the full list of evaluated-and-rejected patterns and the decision tree for adding more.
