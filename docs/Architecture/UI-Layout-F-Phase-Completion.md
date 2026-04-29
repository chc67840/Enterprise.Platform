# UI Layout F-Phase Completion (F.1 → F.6)

> **Date:** 2026-04-26.
> **Branch:** `feature/db-first-pivot` (UI follow-on).
> **Spec:** the F-phase brief — config-driven multi-domain navbar + footer
> for Finance / Healthcare / HR verticals.

All five phases shipped sequentially. SPA build clean (8 s). 129 vitest
passing + 2 pre-existing skips (`+1` from F.1's compile-time spec test).

---

## Sub-phase summary

| Phase | Spec deliverable | Result |
|---|---|---|
| **F.1** | D1 — Type system | `shared/layout/models/nav.models.ts` + `shared/layout/index.ts`; ~55 exported types; compile-time spec at `nav.models.spec.ts` |
| **F.2** | D2/D4/D5 — Navbar refit | `PlatformNavbarComponent` consumes `NavbarConfig`; new `NotificationBellComponent`, `UserMenuButtonComponent`, `TenantSwitcherComponent`; single `(navAction)` dispatcher + `(tenantSwitch)` / `(searched)` / `(logout)` |
| **F.3** | D6 + extracted right-zone | New widgets/ folder: `NavClockComponent`, `ThemeToggleButtonComponent`, `LanguageSwitcherComponent`, `QuickActionsComponent` |
| **F.4** | D3 — 4 nav-menu variants | `NavMenuComponent` rewrite — flat / tabs / icon / mega from one template; mega uses CSS-grid section panel |
| **F.5** | D7 — Footer refit | `PlatformFooterV2Component` consumes `FooterConfig`; full / minimal / app variants; 7 compliance badges; newsletter; cookie consent (localStorage); social row |
| **F.6** | D8 + D10 — Domain configs + multi-domain shell | Three `*.config.ts` factories (Finance / Healthcare / HR); `DOMAIN_CHROME_REGISTRY`; new `DomainStore` (`@core/services`); `AppShellComponent` swaps via `domains.currentDomain()` |

---

## File map (everything new)

```
src/app/shared/layout/
├── index.ts                                   ← public barrel
├── models/
│   ├── nav.models.ts                          (F.1)
│   └── nav.models.spec.ts                     (F.1)
├── components/
│   ├── platform-navbar/
│   │   └── platform-navbar.component.ts       (F.2 / F.3)
│   ├── nav-menu/
│   │   └── nav-menu.component.ts              (F.4 — 4 variants)
│   ├── notification-bell/
│   │   └── notification-bell.component.ts     (F.2)
│   ├── tenant-switcher/
│   │   └── tenant-switcher.component.ts       (F.2)
│   ├── user-menu-button/
│   │   └── user-menu-button.component.ts      (F.2)
│   ├── platform-footer/
│   │   └── platform-footer.component.ts       (F.5)
│   └── widgets/
│       ├── nav-clock.component.ts             (F.3)
│       ├── theme-toggle-button.component.ts   (F.3)
│       ├── language-switcher.component.ts     (F.3)
│       └── quick-actions.component.ts         (F.3 / spec D6)
└── domains/
    ├── index.ts                               (F.6 — registry)
    ├── finance.config.ts                      (F.6 — ManyMoney)
    ├── healthcare.config.ts                   (F.6 — HealthCo EHR)
    └── hr.config.ts                           (F.6 — HRCore)

src/app/core/services/
└── domain.store.ts                            (F.6 — current-domain signal)

src/app/layouts/app-shell/
└── app-shell.component.ts                     (F.6 — chrome swaps via DomainStore)

docs/Architecture/
├── UI-Layout-Type-System.md                   (F.1 — migration target sheet)
└── UI-Layout-F-Phase-Completion.md            (this file)
```

---

## How a domain swap works (D10 worked example)

```ts
// Anywhere in the app — typically a settings dropdown / dev tool:
inject(DomainStore).setDomain('healthcare');
```

`AppShellComponent`'s `chrome` computed re-evaluates → `[config]` on
`<app-platform-navbar>` and `<app-platform-footer>` flip → PrimeNG / DOM
re-render automatically (no full reload, no destroyed feature routes).

Each domain config is a pure-data literal — zero Angular dependency. A
designer can edit `finance.config.ts` to add a nav item, change a quick
action's icon, or swap a compliance disclaimer with no component change
required.

---

## Single-dispatcher pattern (D1)

Every actionable surface — quick action, AI button, user-menu action row,
help icon, language change, newsletter submit — funnels through one event:

```ts
(navAction)="onNavAction($event)"

onNavAction(e: NavActionEvent): void {
  switch (e.actionKey) {
    case 'auth.logout':         return this.authService.logout();
    case 'trade.create':        return this.tradeStore.openCreate();
    case 'patient.create':      return this.patients.openCreate();
    case 'newsletter.subscribe':return this.marketing.subscribe(e.payload?.email as string);
    // …
  }
}
```

Two surviving outputs (their payloads aren't shape-compatible):
- `(tenantSwitch): NavTenantSwitchEvent`
- `(searched): NavSearchEvent`
- `(logout): NavLogoutEvent`

---

## Permission gating (fail-open)

`NavPermission { requiredPolicy?, featureFlag?, roles? }` on any nav item /
mega-leaf / quick-action / user-menu row. Renderer **hides** items the user
can't see (information-disclosure mitigation per spec). All-undefined =
visible (fail-open). FeatureFlag fail-open until a feature-flag service
lands; roles + policy gates wired via existing `AuthStore`.

---

## Tone-aware widgets (Tailwind-v4-JIT-safe)

Components that work on both light and dark chrome (`NotificationBellComponent`,
`UserMenuButtonComponent`, `ThemeToggleButtonComponent`) take a `tone` input
and switch styles via `[data-tone]` attribute selectors in their styles
block. Tailwind v4 JIT cannot see runtime-built class strings — using
attribute selectors keeps the CSS deterministic. Documented in the F.E
chrome-refactor lessons; re-applied here.

---

## Trims and deferrals (small, documented)

| Item | Why deferred | Where to land |
|---|---|---|
| Command palette (Cmd-K) | Spec lists `commandPaletteMode: true` on `globalSearch`; the renderer emits a `NavActionEvent` with `actionKey: 'search.commandPalette'` and the host stubs the dispatch. The actual palette UI is its own feature. | New `core/services/command-palette.service.ts` + a deferred-loaded component |
| Mobile-first SCSS file split | ~~Used inline `styles: [...]`~~ **Done 2026-04-29.** All F-phase components migrated to sibling `*.component.scss` via `styleUrl` as part of the codebase-wide SCSS migration. See `Demo/scss-migration-audit.md`. | — |
| Storybook stories | Storybook removed in Phase 5 (memory `reference_storybook_removed.md`). Reintroduction is a separate decision. | If reintroduced, add `*.stories.ts` per component |
| Unit tests for the new widgets | Type contract + builds pass; runtime tests would be high-value but high-line. | Add as time permits — pattern: TestBed + `provideHttpClient(withInterceptors([]))` mirrors the existing `users-api.service.spec.ts` |
| Per-tenant compliance disclaimer text | Lives in the static factory today. | Make the disclaimer a `Signal<string>` driven by tenant when the BFF tenant-config endpoint ships |

---

## Verification snapshot

```text
$ ng build --configuration development
... Application bundle generation complete. [7.976 seconds]

$ vitest run
... 129 passed | 2 skipped (131)

Initial bundle: ~2.6 MB (lazy chunks split per route)
Lazy chunks: dashboard, users-list, user-detail, user-create,
             session-expiring-dialog, login, error pages, etc.
```

---

## Demo paths

1. **Switch to Healthcare:** in any browser console while on the app:
   ```js
   localStorage.setItem('ep:active-domain', 'healthcare'); location.reload();
   ```
   Navbar → records / billing items appear with permission gates; right zone
   shows shift-status pill, messages bell, clinical-AI button. Footer goes
   minimal-variant with HIPAA + SOC2 + ISO27001 + GDPR badges and the
   45 CFR §164.308 disclaimer.

2. **Switch to HR:**
   ```js
   localStorage.setItem('ep:active-domain', 'hr'); location.reload();
   ```
   Tabs nav (active item gets bottom underline); language switcher (en / es / fr)
   appears in the right zone; footer shows EEOC disclaimer + EEOC + SOC2 + GDPR
   badges.

3. **Switch back to Finance:**
   ```js
   localStorage.setItem('ep:active-domain', 'finance'); location.reload();
   ```
   Mega-menu Analytics column; NYSE clock; "Live" pulse badge on the Signals
   nav item; FINRA + SOC2 + GDPR badges; SEC/FINRA disclaimer.

A future settings dropdown will expose this via `DomainStore.setDomain(...)`
without the localStorage hop.

---

## Next reasonable follow-ups (not blocking F)

- Pull `core/services/domain.store.ts` consumers into a `<select>` in the
  user menu so non-engineers can flip domains.
- Wire a real notifications feed into the bells (BFF endpoint stub today
  returns mock data).
- Add `commandPaletteMode` actual palette component.
- Replace the legacy `shared/components/navigation/*` tree with the new
  layout module + delete the legacy directory.
