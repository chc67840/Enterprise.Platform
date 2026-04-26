# UI Layout Type System (Phase F.1)

> **Date:** 2026-04-26.
> **Branch:** `feature/db-first-pivot` (UI follow-on after Phase E chrome refactor).
> **Spec source:** the F-phase brief (config-driven multi-domain navbar + footer for Finance / Healthcare / HR).
> **This phase:** types only. Zero behaviour change. Zero component edits.

The new types live at `src/app/shared/layout/models/nav.models.ts` and re-export through `@shared/layout`. They form the canonical config shape every chrome component will consume after the F.2 – F.6 refit.

---

## 1. What got added

```
src/app/shared/layout/
├── index.ts                          # public barrel — only path consumers import from
└── models/
    ├── nav.models.ts                 # the type system (Sections 1–9 inline)
    └── nav.models.spec.ts            # compile-time verification — every variant exercised
```

Plus this doc.

The spec lives in 9 numbered sections inside `nav.models.ts`:

| § | Section | Type count |
|---|---|---|
| 1 | Shared primitives — `RoutePath`, `IconClass`, `NavPermission`, `NavBadge`, `LanguageOption`, `TenantOption`, `EnvBadge`, `UserProfile` | 8 |
| 2 | Nav menu items — `NavMenuItem`, `NavMenuLeaf`, `NavMenuSection`, `NavMenuConfig`, `NavMenuVariant`, `NavActiveMatchStrategy` | 6 |
| 3 | Left zone — `NavLogoConfig`, `NavTenantSwitcherConfig`, `NavLeftZoneConfig` | 3 |
| 4 | Right-zone widgets — clock, market, shift, search, AI, quick actions, messages, notifications, help, theme, language, user menu | 14 |
| 5 | Top-level — `NavbarConfig` | 1 |
| 6 | Footer — `FooterConfig`, columns, newsletter, compliance, social, bottom bar, variant | 10 |
| 7 | Output events — action / tenant / search / logout | 4 |
| 8 | Notifications DTO | 2 |
| 9 | Convenience — `DomainChromeConfig` | 1 |

Total: **~55 exported types** covering every spec deliverable's shape.

---

## 2. Existing-component → new-type mapping

The chrome components shipped before F.1 (`PlatformTopNavComponent`, `UserMenuComponent`, `NotificationsPopoverComponent`, `PlatformFooterComponent`) consume their own ad-hoc input shapes. The table below is the migration target sheet F.2 – F.6 will follow.

### 2.1 PlatformTopNavComponent (shared/components/navigation/platform-top-nav)

| Current input / behaviour | New type | Notes for F.2 |
|---|---|---|
| `branding: NavBranding` (`{productName, productSubLabel, logoIcon, homeRouterLink}`) | `NavbarConfig.leftZone.logo` (`NavLogoConfig`) | Renamed `productName` → `brandName`, `productSubLabel` → `subLabel`, `homeRouterLink` → `homeRoute`. Adds `envBadge`, `imageSrc`, `alt` (now required). |
| `items: readonly NavMenuItem[]` (legacy shape from `nav-menu.types.ts`) | `NavbarConfig.centerZone.menu.items` (the new `NavMenuItem`) | Renamed `routerLink` → `routePath`; `kind` discriminator dropped (children-presence is the new discriminator); `requiredPermissions[] / requiredRoles[]` collapsed into `NavPermission`. Mega-menu `children` now lists `NavMenuSection` (heading + leaves) instead of flat `NavMenuItem[]`. |
| `showNotifications: boolean` | `NavbarConfig.rightZone.notifications.enabled` | One axis of the broader right-zone widget map. |
| `(searchClick)` / `(appsClick)` outputs | `NavbarConfig.rightZone.globalSearch` + `NavbarConfig.rightZone.quickActions` (or `aiAssistant`) | Outputs collapse into the single `(navAction)` event with `source: 'globalSearch' | 'quickAction' | 'aiAssistant'`. |
| `(notificationClick)` output | `(navAction)` with `source: 'notification'`, `payload: { id }` | Single dispatcher pattern. |
| `(profileClick)` / `(settingsClick)` outputs | `(navAction)` with `source: 'userMenu'`, `actionKey: 'profile'` / `'settings'` | Same — funnel through the single dispatcher. |

### 2.2 UserMenuComponent (shared/components/navigation/user-menu)

| Current input / behaviour | New type | Notes |
|---|---|---|
| `tone: 'light' | 'dark'` | Stays as a renderer-internal concern (not in config). | The chrome variant decides the tone; the config doesn't carry it. |
| Hardcoded items (Profile, Settings, Theme, Sign out) | `NavbarConfig.rightZone.userMenu.menuItems: readonly UserMenuItem[]` | Domain config now lists every row. Theme item moves out into the standalone `themeToggle` widget when `enabled`. |
| `(profileClick)` / `(settingsClick)` | Single `(navAction)` with `source: 'userMenu'` | Same dispatcher consolidation. |
| `auth.displayName/email` injected | Comes from `userProfile()` input on the navbar (typed `UserProfile`) | Decouples chrome from `AuthService` — adapter pattern lives in the shell. |

### 2.3 NotificationsPopoverComponent (shared/components/navigation/notifications-popover)

| Current input / behaviour | New type | Notes |
|---|---|---|
| Internal `MOCK_NOTIFICATIONS` signal | `notifications` input typed `readonly NavNotification[]` | Mock moves out of the component into the shell's data feed. |
| `NavNotification` (legacy) — `{ id, title, body?, createdAt, read, severity? }` | New `NavNotification` (Section 8) — `{ id, level, title, message?, createdAt, read, deepLink?, actor? }` | `severity` → `level` enum (`info | success | warning | critical`); `body` → `message`; adds `deepLink` + `actor`. |
| `(notificationClick)` | `(navAction)` `source: 'notification'`, `payload: { id }` | Same dispatcher. |
| `(viewAllClick)` | Resolves automatically via `NavBellWidgetConfig.viewAllRoute` | Click navigates; no separate output needed. |
| `tone` input (light / dark) | Stays — renderer concern. | |

### 2.4 PlatformFooterComponent (shared/components/platform-footer)

| Current input / behaviour | New type | Notes |
|---|---|---|
| `productName / tagline / brandIcon / blurb` | `FooterConfig.logo` (`FooterLogoConfig`) + `FooterConfig.tagline` | `imageSrc + alt` (`alt` required), or `brandName` fallback. `blurb` becomes the column-section description; not a separate field. |
| `linkColumns: readonly FooterColumn[]` | `FooterConfig.columns: readonly FooterLinkColumn[]` | Rename + new optional `badge` per `FooterLink`. |
| `legalLinks: readonly FooterLink[]` | `FooterConfig.bottomBar.links` | Moved from a top-level prop into the bottom-bar substructure. |
| `version / buildId` | `FooterConfig.bottomBar.appVersion / buildId` | Same field, new path. |
| Single layout (always full) | `FooterConfig.variant: 'full' | 'minimal' | 'app'` | Renderer branches at template top. |
| (none) | `FooterConfig.compliance` (badges + disclaimer + cookieConsent) | New section per spec. |
| (none) | `FooterConfig.newsletter` | New widget. |
| (none) | `FooterConfig.social` | New widget. |
| (none) | `FooterConfig.bottomBar.statusPageUrl` | New — drives the status pulse-dot link. |

---

## 3. Cross-cutting changes the F.2 – F.6 work has to honour

### 3.1 Single dispatcher (`NavActionEvent`)

Every right-zone surface that "does something" — quick action, AI button, user-menu action row, message click, notification click, help icon, newsletter submit — funnels through one output:

```ts
@Output() navAction = output<NavActionEvent>();
```

Hosts switch on `actionKey`:

```ts
onNavAction(e: NavActionEvent): void {
  switch (e.actionKey) {
    case 'trade.create':   return this.tradeStore.openCreateDialog();
    case 'auth.logout':    return this.auth.logout();
    case 'help.shortcuts': return this.shortcutPalette.open();
    // …
  }
}
```

This replaces the per-action `@Output()` proliferation in today's components. Two outputs survive on the navbar (because their payloads aren't shape-compatible with `NavActionEvent`):

| Output | Carrier type |
|---|---|
| `(tenantSwitch)` | `NavTenantSwitchEvent` |
| `(searched)` | `NavSearchEvent` |
| `(logout)` | `NavLogoutEvent` |
| `(navAction)` | `NavActionEvent` (everything else) |

### 3.2 Permission gating — fail-open

`NavPermission` carries `requiredPolicy?`, `featureFlag?`, `roles?` (ANY-of). When **all three** are undefined the renderer treats the item as visible (fail-open). Renderers must hide items the user can't see (information-disclosure mitigation per spec) — not disable them. Disabled-but-visible uses the separate `disabled?: boolean` field.

### 3.3 Renderer concerns NOT in the config

These stay out of the config because they're chrome-implementation details, not domain decisions:

- `tone: 'light' | 'dark'` — a chrome variant chooses its own surface palette
- Mobile breakpoint for the hamburger (default 1024 px; CSS-only, not `*ngIf`)
- Glass-morphism scroll-listener attach/detach (scoped to the component)
- Z-index layering (cookie consent vs. toast vs. confirm dialog)
- ARIA live-region politeness for notifications (driven by `level`, not configurable)

### 3.4 Routes typed via the shared `RoutePath`

`RoutePath = string | readonly (string | number)[] | UrlTree`. Every link field in the spec uses this type so dynamic links (`['/users', userId]`) and `Router.parseUrl(...)` returns are both legal without wrapping.

---

## 4. What F.1 deliberately did NOT do

| Skipped | Why | Where it lands |
|---|---|---|
| Refactor any existing component to consume the new types | Out of scope for "type system only" | F.2 (navbar refit) |
| Adapter from legacy `NavMenuItem` (in `shared/components/navigation/`) → new `NavMenuItem` | No consumers yet — premature | F.2, when the navbar refit needs to swap |
| `MenuConfigService` rewrite to emit `NavbarConfig` | Service still reads from the legacy type | F.2 |
| Domain config factories (`createFinanceConfig`, etc.) | No new components to consume them | F.6 |
| Migration warning / deprecation tags on legacy types | Both shapes live side by side cleanly | If they outlast F.6 |

---

## 5. Verification

```text
$ ng build --configuration development     ↦ clean (zero warnings, zero errors)
$ vitest run                               ↦ 129/130 pass + 2 skips (the +1 is the new compile-time spec test)
```

The compile-time spec at `nav.models.spec.ts` exercises every type variant — 4 menu shapes, every right-zone widget, all `UserMenuItem` kinds, every footer variant + compliance badge, all event types, the `DomainChromeConfig` composite. If a future edit drifts the types, that file fails to compile with a clear pointer at the breaking line.

---

## 6. Migration sequence after F.1

1. **F.2 — Navbar refit.** Update `PlatformTopNavComponent` to take `[config]: NavbarConfig` instead of `[branding]` + `[items]`. Add the missing right-zone widgets (env badge, tenant switcher, clock, theme toggle, language switcher, hamburger).
2. **F.3 — Right-zone widgets.** Add the standalone components for quick actions, AI assistant, help, messages, market/shift status. Each is small + isolated.
3. **F.4 — Nav-menu variants.** `NavMenuComponent` rewrite to render all four variants from one template (flat / mega / icon / tabs).
4. **F.5 — Footer refit.** `PlatformFooterComponent` to consume `FooterConfig`. Add variant branching, compliance, newsletter, cookie consent, social.
5. **F.6 — Domain configs + multi-domain shell.** Author `createFinanceChrome()` / `createHealthcareChrome()` / `createHrChrome()`. Refactor `AppShellComponent` to swap the chrome based on a `domainStore` signal.

Each phase is independently shippable + verifiable. The type system in F.1 is the contract that lets them happen in any order — even by different developers in parallel.
