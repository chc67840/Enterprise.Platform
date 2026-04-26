# UI — Sub-Nav Zone Architecture

The **sub-nav zone** is everything rendered between the top navbar and the
main page content. The app-shell mounts exactly one component for this
zone — `<app-sub-nav-orchestrator>` — and the orchestrator owns the order,
priority, and visibility of every sub-nav element.

> **Status — 2026-04-26.** Lean Bucket A: orchestrator + breadcrumb +
> page-header are live. The 12 banner-priority slots in the canonical
> spec below are reserved as documentation; only the StatusBannerService-
> driven slot is wired. Add new slots when a real underlying system
> (impersonation, billing, risk engine, etc.) drives the trigger.

## Render order (top → bottom)

```
┌─────────────────────────────────────────────────────────┐
│  <app-platform-navbar>             (sticky, z-index 30) │
├─────────────────────────────────────────────────────────┤
│  <app-sub-nav-orchestrator>                             │
│    1.  <app-status-banner-host>                         │
│        ├─ impersonation     [reserved — Bucket C]       │
│        ├─ offline           [reserved — Bucket B]       │
│        ├─ maintenance       [via StatusBannerService]   │
│        ├─ risk/compliance   [reserved — Bucket C]       │
│        ├─ system            [via StatusBannerService]   │
│        ├─ contextual        [via StatusBannerService]   │
│        ├─ trial/subscription[reserved — Bucket C]       │
│        ├─ feature announce  [reserved — Bucket C]       │
│        └─ read-only         [reserved — Bucket C]       │
│    2.  <app-breadcrumb>            (auto from router)   │
│    3.  <app-page-header>           (per-route config)   │
│        ├─ page tabs         [reserved — Bucket B]       │
│        ├─ quick filter bar  [reserved — Bucket B]       │
│        └─ progress steps    [reserved — Bucket B]       │
├─────────────────────────────────────────────────────────┤
│  <main id="main-content">          (router-outlet)      │
└─────────────────────────────────────────────────────────┘
```

## How each piece is wired

### 1 — Status banners (today)
Banner content is pushed via `StatusBannerService.push({ severity, title, message, ... })`.
The host renders all active banners stacked, with severity-driven ARIA roles
(polite for info/success/maintenance, assertive for warning/danger).

For a brand-new banner that doesn't fit "info/success/warning/danger/
maintenance", add a new severity to the service rather than building a
new component. Component-per-banner is rejected — each new component
is rigid, untested in real workflows, and rots quickly.

### 2 — Breadcrumb (today, automatic)
`BreadcrumbService` listens to `NavigationEnd`, walks the active route
tree, and emits `BreadcrumbItem[]`. Routes declare their crumb in
`data.breadcrumb`:

```ts
data: {
  // Static label
  breadcrumb: 'Users',

  // Dynamic label from route params
  breadcrumb: (params) => params['id'] ?? 'Detail',
} satisfies RouteMetadata
```

The component renders `<nav aria-label="Breadcrumb"><ol>` with the last
item as a non-link `aria-current="page"` span. Mobile collapse: when
trail length > 3, render first → ellipsis → last 2.

Hidden when trail length < 2 (showing "Home" alone is noise).

For a dynamic label sourced from an API resolver — set it on the route's
data via the resolver, OR override at runtime by patching the
`ActivatedRoute.data` (rare; usually static + param-derived covers it).

### 3 — Page header (today, two-source config)
Source precedence — service wins over route data:

1. `PageHeaderService.config()` — page set this dynamically (e.g. title
   from a resolved entity)
2. `route.data.pageHeader` — declared statically on the route
3. `null` — header is hidden entirely

```ts
// Static — declare on the route
data: {
  pageHeader: {
    title: 'Users',
    icon: 'pi pi-users',
    primaryAction: { label: 'New user', actionKey: 'users.create' },
  },
}

// Dynamic — from a feature page after the entity loads
constructor() {
  effect(() => {
    const u = this.user();
    if (!u) return;
    inject(PageHeaderService).set({
      title: u.displayName,
      subtitle: u.email,
      badge: { label: u.role, variant: 'info' },
      primaryAction: { label: 'Edit', actionKey: 'users.edit' },
    });
  });
}
```

The page-header emits `actionKey` strings via `(action)`. The orchestrator
re-emits, the app-shell routes them through `onPageHeaderAction()` → the
existing `onNavAction()` dispatcher. **Pages must NOT render their own
`<h1>`** — WCAG 2.4.6 (single h1 per page). The page-header is the h1.

The page-header service auto-clears on `NavigationStart` so a stale
header from the previous page can't bleed in.

## What's not built (and why)

| Slot | Why deferred | Build trigger |
|---|---|---|
| Impersonation banner | No impersonation feature | First admin-impersonate-user flow |
| Offline banner | Trivial — single trigger | Anytime; small enough to build on demand |
| Maintenance banner | Already covered by StatusBannerService severity `maintenance` | If a richer "countdown timer" UI is needed |
| Trial / Subscription banner | No billing system | First billing integration |
| Feature announcement banner | No release-comms feed | First "what's new" requirement |
| Read-only banner | No record-locking | First locked-record feature |
| Risk / Compliance alert | No risk engine | First risk feature (margin alerts, lab thresholds, etc.) |
| Market status bar | Already inline in navbar widgets | If it needs to also live in sub-nav |
| Page tabs | No tabbed feature pages | First feature with tabbed sub-views |
| Quick-filter toolbar | No data-list feature complex enough | First page with sortable + filterable list |
| Progress / step indicator | No multi-step wizards | First wizard / onboarding flow |

When a deferred slot lands:
1. Build the component in `src/app/shared/layout/sub-nav/<name>/`
2. Add the trigger source (signal, service, or API)
3. Render it in `sub-nav-orchestrator.component.ts` at its priority slot
4. Update this doc's table

## Files touched (Bucket A)

```
src/app/shared/layout/sub-nav/
├── breadcrumb.component.ts
├── breadcrumb.service.ts
├── page-header.component.ts
├── page-header.service.ts
├── sub-nav-orchestrator.component.ts
├── sub-nav.types.ts
└── index.ts                         (barrel)

src/app/core/models/route-metadata.model.ts   (+ optional pageHeader field)
src/app/layouts/app-shell/app-shell.component.ts (mounts orchestrator)
src/app/app.routes.ts                          (data.pageHeader on dashboard)
src/app/features/users/users.routes.ts         (data.pageHeader on each view)
src/app/features/dashboard/dashboard.component.ts (drop inline <h2>)
```

## Contract for adding a new banner cleanly

If a new banner type is genuinely needed and doesn't fit any of the
existing StatusBannerService severities:

1. Define the trigger source — usually a service exposing a signal
2. Build a standalone OnPush component scoped to the banner
3. Render it in the orchestrator template at its priority slot
4. Document the slot ownership in this file's render-order diagram
5. **Do not** mount the banner directly anywhere outside the orchestrator
   (single ownership rule — every banner trigger is auditable from one place)

## Forbidden in the sub-nav zone

- Mounting `<app-status-banner-host>`, `<app-breadcrumb>`, or
  `<app-page-header>` outside the orchestrator
- Pages rendering their own `<h1>` (WCAG 2.4.6)
- Pages reading `route.data.breadcrumb` directly — let `BreadcrumbService` do it
- Banner components reading page state, route params, or business data
  directly — every piece of data flows through typed config inputs
- Inline component styles fighting the orchestrator's container width
  (orchestrator already applies `max-width: var(--ep-content-max)` + padding)
