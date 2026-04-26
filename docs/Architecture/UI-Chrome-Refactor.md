# UI Chrome Refactor (Phase E)

> **Date:** 2026-04-26.
> **Branch:** `feature/db-first-pivot` (Phase E follow-on).
> **Authoritative companions:**
> - [`UI-Color-Palette-Strategy.md`](./UI-Color-Palette-Strategy.md) — every brand token + scale
> - [`UI-Styling-Strategy.md`](./UI-Styling-Strategy.md) — PrimeNG + Tailwind cssLayer story
> - [`UI-Typography-Strategy.md`](./UI-Typography-Strategy.md) — three-role font system

This phase removed the collapsible side menu (which was overlapping main
content in some viewports) and replaced it with a **horizontal-only**
canonical chrome: top-nav → status banner host → main → footer. The new
components are generic, brand-token-driven, and fully accessible.

---

## 1. Why this change

The previous shell mounted `TopNavWithSidebarComponent`, which rendered a
left drawer that overlapped the page content rather than pushing it. Two
problems:

1. The drawer wasn't dismissible from inside the content area (only from a
   chrome control), so a sticky drawer covered routes that needed full
   width.
2. Side menus + top nav redundantly enumerate the same items. For a single-
   tenant app with a flat-ish IA (≤ 3 levels), a single horizontal nav is
   simpler to scan.

We also wanted a dedicated slot for **persistent system / business
notices** that aren't transient (toasts) but aren't page-owned either —
maintenance windows, compliance overlays, billing flags, beta-feature
announcements.

---

## 2. New components

| File | Purpose |
|---|---|
| `core/services/status-banner.service.ts` | Signal-backed registry. Any feature pushes `StatusBanner` rows; the host renders. Severities: info / success / warning / danger / maintenance. Optional dismiss-persistence via `localStorage`. |
| `shared/components/status-banner/status-banner-host.component.ts` | Renders 0..N banners stacked, brand-token-coloured. ARIA `role` selected per severity (`status` for soft, `alert` for warning/danger). Dismiss button is 44×44 (WCAG 2.5.5). |
| `shared/components/navigation/platform-top-nav/platform-top-nav.component.ts` | Full-width brand chrome. Logo + product name on the left, PrimeNG `Menubar` (with router-aware items) in the middle, right-side actions (search / apps / notifications / user menu). Indigo `primary-700` surface, Jessamine focus rings, white text (9.62 : 1 contrast — AAA). Skip-to-main link first. |
| `shared/components/platform-footer/platform-footer.component.ts` | Multi-column responsive footer. Brand mark + 3 link columns + bottom strip with copyright + version + legal links. Top border in `palmetto-500`. `role="contentinfo"`. |

All four components use **only design tokens** from `tokens.css` — no
hard-coded hex values. A tenant rebrand (per
[Color-Palette-Strategy §10.1](./UI-Color-Palette-Strategy.md#101-change-the-primary-brand-colour-eg-swap-indigo-for-teal))
flows through automatically.

---

## 3. Layout shape (the new shell)

```
┌──────────────────────────────────────────────────────────────────┐
│ ▌ progress bar (LoadingService)                                  │
├──────────────────────────────────────────────────────────────────┤
│ [LOGO] Enterprise Platform · Workspace                           │
│        Dashboard  Workspace ▾  People ▾  Reports ▾  Settings     │
│                                              [🔍][⌘][🔔][HC ▾]   │
├──────────────────────────────────────────────────────────────────┤
│ ⚠️  Scheduled maintenance Sunday 02:00 UTC — saves disabled…  ✕ │  ← status banner host
│ 🛡️  You're viewing PHI. Audit log enabled.                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    <router-outlet>                               │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ palmetto │
│  [LOGO]                Platform           Resources    Support   │
│  Enterprise Platform   Dashboard          Documentation Help…    │
│  A unified workspace…  Users              API reference Contact… │
│                        Settings           Status        Bug…     │
│                                                                  │
│  © 2026 Enterprise Platform. v1.4.2 · 7a8b9c     Privacy · Terms │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Pushing a status banner

Any service / handler / component can push:

```typescript
import { StatusBannerService } from '@core/services';

private readonly banners = inject(StatusBannerService);

ngOnInit(): void {
  this.banners.push({
    id: 'maintenance-2026-05-01',
    severity: 'maintenance',
    title: 'Scheduled maintenance',
    message: 'Sunday 02:00 – 03:00 UTC. Saves are disabled during the window.',
    dismissable: true,
    dismissPersist: true,             // remembered across sessions
    action: {
      label: 'Read announcement',
      invoke: () => window.open('https://status.example.com/...', '_blank'),
    },
  });
}
```

**Recipes:**

| Scenario | Recommended severity | `dismissable` | `dismissPersist` |
|---|---|---|---|
| Scheduled maintenance window | `maintenance` | `true` | `true` |
| You're viewing PHI / SOX-regulated data | `info` | `false` | n/a |
| Trial expires in 7 days | `warning` | `true` | `false` |
| Billing past due — saves blocked | `danger` | `false` | n/a |
| Feature flag "beta" notice | `info` | `true` | `true` |
| Network offline detected | `danger` | `false` | n/a |
| Cookie / privacy notice | `info` | `true` | `true` |

**Anti-patterns:**

- Don't use a banner for transient feedback ("User saved") — that's a toast.
- Don't push a banner whose lifetime is "until the user navigates" — that's
  a route-level state, not a system state.
- Don't push two banners with the same `id` — the second replaces the first
  (deliberate; lets a feature update its banner content in place).

---

## 5. Accessibility checklist

| WCAG criterion | How the new chrome satisfies it |
|---|---|
| 1.4.3 Contrast (Minimum) AA | White on `primary-700` = 9.62 : 1 AAA. Banner text uses brand 800-step on 50-step bg (≥ 6.18 : 1 AA). Dark mode flips via `.dark` class. |
| 1.4.1 Use of Colour | Every banner has an icon + text label; severity is never communicated by colour alone. |
| 2.4.1 Bypass Blocks | Skip-to-main link is the first focusable element in the top nav (visually hidden until focused). |
| 2.4.6 Headings & Labels | Footer columns have `<h3>`s. Nav has `aria-label="Primary"`. Footer has `role="contentinfo"`. |
| 2.4.7 Focus Visible | All focusable elements show a `:focus-visible` ring in `--ep-color-jessamine-500`. |
| 2.5.5 Target Size (AA) | Dismiss buttons are 36 px visual / 44 px hit area. Icon buttons in the top nav are 40×40 visual / 44 minimum hit area via padding. |
| 4.1.3 Status Messages | Soft severities use `role="status"` (polite); warning/danger use `role="alert"` (assertive). Screen readers announce appropriately. |

---

## 6. Component customisation surface

### `PlatformTopNavComponent`

```html
<app-platform-top-nav
  [branding]="{ productName: 'Acme Health', logoIcon: 'pi pi-heart', homeRouterLink: '/dashboard' }"
  [items]="menuItems()"
  [showNotifications]="true"
  (notificationClick)="...."
  (profileClick)="...."
  (settingsClick)="...."
  (searchClick)="...."
  (appsClick)="...."
/>
```

- `branding` — tenant / product chrome (logo image OR icon glyph fallback + product name + sub-label).
- `items` — the authorisation-filtered menu tree from `MenuConfigService`. The component does not enforce permissions; it just renders what it's given.
- `showNotifications` — hides the bell when the host doesn't want it (e.g. on a branded landing route).

### `PlatformFooterComponent`

Every column / link is an input — defaults work for most tenants:

```html
<app-platform-footer
  productName="Acme Health"
  tagline="Enterprise"
  brandIcon="pi pi-heart"
  blurb="Acme's unified care workspace."
  [linkColumns]="customColumns"
  [legalLinks]="customLegal"
  version="2.4.1"
  buildId="9f7a3b2c"
/>
```

### `StatusBannerService`

Single registry. Tests can call `service.clear()` or
`service.resetDismissed()` to reset between specs. The persistence is
best-effort (Safari private mode etc. silently no-op).

---

## 7. Files touched

```
add  src/app/core/services/status-banner.service.ts
mod  src/app/core/services/index.ts                        # export StatusBannerService + types
add  src/app/shared/components/status-banner/status-banner-host.component.ts
add  src/app/shared/components/navigation/platform-top-nav/platform-top-nav.component.ts
mod  src/app/shared/components/navigation/index.ts         # export PlatformTopNavComponent
add  src/app/shared/components/platform-footer/platform-footer.component.ts
mod  src/app/layouts/app-shell/app-shell.component.ts      # use new chrome trio
```

Legacy `TopNavWithSidebarComponent`, `TopNavHorizontalComponent`, and
`TopNavCompactComponent` are kept exported from the navigation barrel —
embeds and tenant variants can still pick them. The default for new shells
is `PlatformTopNavComponent`.

---

## 8. Verification snapshot

```text
$ ng build --configuration development
... Application bundle generation complete. [3.012 seconds]

$ vitest run
... 128 passed | 2 skipped (130)

Visual smoke (Chrome / Edge / Firefox):
  - Top nav fills viewport width; brand mark on left, menu in middle, actions on right
  - Status banners appear when StatusBannerService.push(...) is called
  - Footer pinned at bottom on tall pages, sits below content on short
  - Focus ring visible on tab through every interactive element
```

---

## 9. Open follow-ups

| Item | Why deferred | Where to land |
|---|---|---|
| Mobile (< 768 px) hamburger collapse | PrimeNG Menubar handles this natively but the styling polish wasn't tuned this round | `platform-top-nav.component.ts` styles block — add a `:host ::ng-deep .p-menubar-mobile` ruleset |
| Status-banner unit tests | API service + mapper tests cover the larger-surface code; banner host is mostly markup | `tests/...status-banner*.spec.ts` — assert role attr per severity, dismiss flow |
| Maintenance-banner provider example | The infrastructure is in place; an example wiring (e.g. `MaintenanceWindowService` that polls `/api/v1/system/maintenance` and pushes a banner) is left to the team to author per concrete use case | New service under `core/services/` when the first real feed lands |
| Storybook stories for the four new components | Storybook was removed in Phase 5 follow-up; reintroduction is a separate decision | If reintroduced, stories under `*.stories.ts` next to each component |
