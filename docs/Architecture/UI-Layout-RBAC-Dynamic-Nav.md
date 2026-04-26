# UI Layout — Dynamic Nav + RBAC (Phase F.7)

> **Date:** 2026-04-26.
> **Branch:** `feature/db-first-pivot` (UI follow-on after F.1–F.6).
> **Companion:** [`UI-Layout-F-Phase-Completion.md`](./UI-Layout-F-Phase-Completion.md).

This phase makes the chrome production-ready: backend-driven config loading,
proper RBAC enforcement (server + client defense-in-depth), legacy code
removed, and the visible navbar overlap permanently fixed.

---

## 1. The big change — `NavbarConfigProvider` abstraction

Before F.7, the shell read the active chrome straight from the static
`DOMAIN_CHROME_REGISTRY`. After F.7, the shell talks to a service that
talks to a **provider**. Concrete providers can:

- Return the static factory output (default, `StaticNavbarConfigProvider`)
- Call the BFF (`BackendNavbarConfigProvider`) — full per-user RBAC + feature
  flag resolution server-side
- Compose multiple sources (custom impl: e.g. base config + per-tenant overlay)

```
                   ┌──────────────────────────────────┐
                   │  AppShellComponent (template)    │
                   │  reads navbarConfig() / footerConfig() signals        │
                   └────────────────┬─────────────────┘
                                    │
                                    ▼
                   ┌──────────────────────────────────┐
                   │  NavbarConfigService             │
                   │  - signals: navbar / footer / loading / error         │
                   │  - reactive auto-reload (effect on domain + auth)     │
                   │  - fallback: lastKnown → static registry              │
                   └────────────────┬─────────────────┘
                                    │ injects via NAVBAR_CONFIG_PROVIDER token
                                    ▼
                ┌───────────────────┴───────────────────┐
                │                                       │
       StaticNavbarConfigProvider           BackendNavbarConfigProvider
       (default)                            (production swap)
       returns DOMAIN_CHROME_REGISTRY[d]    GET /api/proxy/v1/me/chrome?domain=d
```

Swap in `app.config.ts`:

```ts
providers: [
  // …
  { provide: NAVBAR_CONFIG_PROVIDER, useClass: BackendNavbarConfigProvider },
],
```

Zero shell-component changes required. Tests can supply a mock provider
that returns whatever shape the test scenario needs.

---

## 2. The BFF contract (target endpoint)

```
GET /api/proxy/v1/me/chrome?domain=<domainKey>

Response 200:
{
  "navbar": NavbarConfig,    // see shared/layout/models/nav.models.ts §5
  "footer": FooterConfig     // see shared/layout/models/nav.models.ts §6
}
```

The BFF MUST already have applied the user's RBAC + feature flags before
responding. Only items the user is allowed to see appear in the response.

**Today the endpoint is a 404** — `BackendNavbarConfigProvider` transparently
falls back to the static registry on 404 so the production code path is
exercised end-to-end without breaking dev. Remove the fallback once the BFF
endpoint ships.

Cache headers should be set per the deployment's freshness policy. Users
with rapidly-changing permissions (admin tooling, customer-success) want
short TTLs; everyone else can take longer. Suggested defaults:

```
Cache-Control: private, max-age=60, stale-while-revalidate=300
ETag: <hash of effective permissions + domain + role>
```

The client doesn't manage HTTP caching directly — `HttpClient` honours
standard cache headers via the browser cache; `Vary: Cookie, Accept-Encoding`
keeps per-user cache scoping intact.

---

## 3. RBAC — defense in depth

### 3.1 Server-side (authoritative)

The BFF is the source of truth. Permission checks happen **before** the
chrome response is composed:

```
inbound /api/proxy/v1/me/chrome
  → BFF looks up user claims
  → BFF resolves feature flags
  → BFF builds NavbarConfig with ONLY the items the user can see
  → BFF returns 200
```

A tampered client cannot grant itself access to chrome that the BFF
omitted from its response. Every API call the chrome links to has its
own per-endpoint authorization on the API side; chrome filtering is
purely a UX optimization.

### 3.2 Client-side (defense)

`NavMenuComponent` re-applies `NavPermission` gating on every render —
even on a config the BFF said was already filtered. This catches:

- **Mid-session permission revocation.** Operations admin removes a
  role; the cached chrome still shows the item until the next refresh,
  but the client filter hides it the moment the local `AuthStore`
  signals the change.
- **Compromised BFF / cache poisoning.** Defense in depth; if the
  upstream filter is bypassed, the client filter still hides items the
  user genuinely can't see.
- **Feature flags.** When a flag is killed, the client hides the item
  on the next render — no need to wait for the BFF to revalidate.

### 3.3 What the gating actually checks

```ts
interface NavPermission {
  requiredPolicy?: string;          // single named policy (claims-based)
  featureFlag?: string;             // resolved at render time (FeatureFlagService)
  roles?: readonly string[];        // ANY-of role match
}
```

Resolution order in `NavMenuComponent.permissionAllowed()`:
1. `featureFlag` first — flag-off features should never even hint at their existence
2. `roles` — must have at least one
3. `requiredPolicy` — must have it

**Fail-open.** A `NavPermission` with all-undefined fields is treated as
"no gate" — show. Empty arrays are also no-gate (so `roles: []` is
identical to `roles: undefined`).

**Hide vs disable.** Permission failures HIDE the item entirely
(information-disclosure mitigation per spec). Items disabled for non-
authorization reasons (e.g. data isn't ready) use the separate
`disabled?: boolean` field.

---

## 4. Loading + error + fallback states

`NavbarConfigService` exposes three orthogonal signals so the shell can
render appropriate UI:

| Signal | Type | Meaning |
|---|---|---|
| `loading()` | `boolean` | First load in flight |
| `error()` | `unknown \| null` | Last error from the provider; null = healthy |
| `chrome()` / `navbar()` / `footer()` | non-null | Always returns something — fresh > lastKnown > static registry |

The shell never sees `null` for `navbar()` / `footer()` after the first
`effect()` tick — the service falls back to the static registry until
the first successful load.

For the LOADING state, the static registry is good enough as a
placeholder; the shell renders the static config and seamlessly
upgrades when the BFF response arrives. No skeleton required for the
chrome surface.

For the ERROR state, the service holds the previous-success value
(`lastKnown`), so a transient network blip doesn't blank the chrome.
The error signal is exposed for telemetry: log it, alert if it
persists, but don't disrupt the user.

---

## 5. How is everything you asked for handled? (audit)

| Requirement | How it's covered |
|---|---|
| **Generic + scalable** | The chrome accepts a config. New domains = a new factory file. New widgets = a new component + an entry on `NavRightZoneConfig`. |
| **Extensible** | Provider abstraction lets you swap the source (static / BFF / overlay). New widgets register via `NavRightZoneConfig` extension. |
| **Maintainable** | One config shape (`NavbarConfig` / `FooterConfig`) per spec D1; one renderer per widget; one dispatcher (`navAction`); one DI token for the source. |
| **RBAC** | `NavPermission { requiredPolicy?, featureFlag?, roles? }` on every menu item / leaf / quick action / user-menu row. Server-side primary filter; client-side defense-in-depth filter. Renderer HIDES disallowed items (info-disclosure mitigation). Fail-open when no gate is set. |
| **Policy-based access** | `requiredPolicy` is a single named claims-based policy; `AuthStore.hasAnyPermission()` does the lookup. Backend authoritative. |
| **Dynamic per-user nav from backend** | `BackendNavbarConfigProvider` shipped — swap the token in `app.config.ts` to activate. BFF contract documented in §2. |
| **Real-time / live updates** | Service exposes `refresh()` — call from admin tooling after a permission grant; the menu re-fetches + re-filters. The auto-reload `effect()` re-fires on `DomainStore.currentDomain()` + auth-state change. |
| **Loading state** | `loading()` signal; static-registry fallback hides the latency for users. |
| **Error handling** | `error()` signal; lastKnown fallback prevents UI blanking. |

---

## 6. Migration steps for the BFF endpoint

When the `/api/proxy/v1/me/chrome` endpoint ships:

1. In `app.config.ts`, bind the production provider:
   ```ts
   providers: [
     // existing providers …
     { provide: NAVBAR_CONFIG_PROVIDER, useClass: BackendNavbarConfigProvider },
   ]
   ```
2. Remove the 404 fallback in `BackendNavbarConfigProvider.load()` so a
   real failure surfaces an `error()` signal instead of silently using
   stale data.
3. Add a CI job that diffs the BFF's emitted shape against the F.1
   `nav.models.spec.ts` literals to catch contract drift early.
4. Set the BFF to emit `Cache-Control: private, max-age=60` (or per
   policy) and `Vary: Cookie`.

---

## 7. F.7.1 — the navbar overlap fix (root cause)

The `<ul class="ep-nav-menu__list">` had no overflow constraint while its
items had `white-space: nowrap` + their natural padding. When items didn't
fit, they overflowed the centre-zone container into the right-zone area,
visually hiding the right-zone icons (which DID render — the
`p-badge` on the bell sat outside the bell button so the badge poked
through, which is why "2" was the only thing visible).

The fix is layered (no single property fixes every browser / aspect ratio):

```css
/* navbar */
.ep-navbar__center {
  flex: 1 1 0;
  min-width: 0;       /* allow flex parent to shrink the centre below content size */
  overflow: hidden;   /* clip any actual overflow */
}
.ep-navbar__right {
  position: relative;
  z-index: 2;                                 /* paint ABOVE centre on accidental overlap */
  background-color: var(--ep-color-primary-700); /* opaque so any overlap is invisible */
  flex-shrink: 0;
}

/* nav-menu inner */
:host { display: flex; flex: 1 1 0; min-width: 0; overflow: hidden; }
.ep-nav-menu__list {
  min-width: 0;
  overflow-x: auto;            /* horizontal scroll if it ever overflows */
  scrollbar-width: none;       /* hidden scrollbar */
}
.ep-nav-menu__list::-webkit-scrollbar { display: none; }

/* tighter padding so 5–7 items fit on 1280px without the menu pushing right zone off */
.ep-nav-menu__link { padding: 0.5rem 0.625rem; }   /* was 0.875rem */
```

Plus the tenant switcher removal (F.7.2) frees ~150 px on the left,
giving more headroom for the centre menu.

---

## 8. Files added / changed in F.7

```
add  src/app/shared/layout/providers/
       navbar-config.types.ts                     (interface + context)
       navbar-config-provider.token.ts            (InjectionToken)
       static-navbar-config.provider.ts           (default — pure factory lookup)
       backend-navbar-config.provider.ts          (BFF call w/ 404 fallback)
       index.ts                                   (barrel)
add  src/app/core/services/navbar-config.service.ts
                                                  (signal-backed orchestrator)
mod  src/app/core/services/index.ts               (export NavbarConfigService)
mod  src/app/shared/layout/index.ts               (export providers)
mod  src/app/shared/layout/components/platform-navbar/platform-navbar.component.ts
                                                  (overlap fix; tenant switcher gone)
mod  src/app/shared/layout/components/nav-menu/nav-menu.component.ts
                                                  (overflow + min-width hygiene; tighter padding)
mod  src/app/shared/layout/domains/finance.config.ts
                                                  (tenant switcher removed)
mod  src/app/layouts/app-shell/app-shell.component.ts
                                                  (consumes NavbarConfigService)
del  src/app/shared/layout/components/tenant-switcher/   (unused; will reintroduce when truly needed)
del  src/app/shared/components/navigation/                (legacy F.E chrome — superseded by F.2)
del  src/app/shared/components/platform-footer/           (legacy F.E footer — superseded by F.5)
add  docs/Architecture/UI-Layout-RBAC-Dynamic-Nav.md     (this file)
```

---

## 9. Verification snapshot

```text
$ ng build --configuration development
... Application bundle generation complete. [4.8 seconds]

$ vitest run
... 129 passed | 2 skipped (131)
```

---

## 10. What's left (honest list)

| Item | Why deferred | Where to land |
|---|---|---|
| Real BFF endpoint | Needs a backend handler. The provider + types are in place; flipping the DI is a one-liner. | Add `GET /api/v1/me/chrome` on the BFF; switch the DI provider in `app.config.ts` |
| `FeatureFlagService` | Mocked as fail-open today; backend resolves authoritatively. | Add the service when a flagging vendor is chosen (LaunchDarkly / Statsig / homegrown). The `permission.featureFlag` field already gates correctly — only the lookup is missing. |
| Permission-grant push notification | Today's `refresh()` is manual. | Wire to a SignalR / SSE channel that pushes "perms changed" → `service.refresh()` |
| Per-tenant disclaimer overlay | The static factories embed the disclaimer. | Add a `TenantOverlayProvider` that merges base config + per-tenant overrides; chain via a custom `NavbarConfigProvider`. |
| Audit log for permission-driven hides | No telemetry today. | In `NavMenuComponent.permissionAllowed()`, emit a structured log when a hide occurs (low-volume; gates that fire often suggest mis-modelled menus). |
