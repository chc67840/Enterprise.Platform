/**
 * ─── shared/layout/models/nav.models.ts ─────────────────────────────────────────
 *
 * The canonical config + event type system for the platform's chrome
 * (`PlatformTopNavComponent` + the to-be-added widget components + the
 * `PlatformFooterComponent`). Domain teams build a `NavbarConfig` /
 * `FooterConfig` literal, hand it to the shell, and never touch the chrome
 * components themselves — that's the contract.
 *
 * SCOPE
 *   Pure types. No values, no decorators, no runtime imports beyond
 *   tree-shakeable Angular `Type<T>` references where a config field carries
 *   a component class. Editable in any environment without pulling Angular
 *   into the dependency graph.
 *
 * VERSIONING
 *   Treat this file like a public API. Renames break every domain's config
 *   literal. Additions are safe; deletions and renames need a deprecation
 *   pass + migration note in `docs/Architecture/UI-Layout-Type-System.md`.
 *
 * SEE ALSO
 *   - docs/Architecture/UI-Layout-Type-System.md — how each existing
 *     component's prop set maps onto these types (the F.2–F.6 migration
 *     target sheet).
 *   - docs/Architecture/UI-Color-Palette-Strategy.md — the brand tokens
 *     every component using these configs must consume.
 */

import type { Routes, UrlTree } from '@angular/router';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Shared primitives
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Router target for any nav / footer link. Mirrors the shape Angular's
 * `Router.navigate` accepts so we don't lose array-style segment links
 * (`['/users', userId]`) — string-only would force every dynamic link to
 * `urlTreeFor(...)` boilerplate.
 */
export type RoutePath = string | readonly (string | number)[] | UrlTree;

/**
 * PrimeIcons class string (e.g. `'pi pi-bell'`). Free-form by design — a
 * future renderer can swap in Material / Heroicons without changing this
 * type, only the renderer.
 */
export type IconClass = string;

/**
 * Authorisation gate. Every field is optional — a `NavPermission` with all
 * fields undefined is the same as "no gate, everyone sees it" (fail-open
 * for menu items per spec D3).
 *
 * Resolution order (when the renderer evaluates):
 *   1. `featureFlag` — gates ahead of role / policy (a flag-off feature
 *      shouldn't even hint at its existence).
 *   2. `roles` — ANY-of match (caller has at least one).
 *   3. `requiredPolicy` — single named claims-based policy.
 *
 * Hide vs disable: spec wants HIDE on permission failure (information-
 * disclosure risk in regulated domains). Disabled-but-visible items use the
 * separate `disabled?: boolean` field on the consuming type.
 */
export interface NavPermission {
  /** Single named policy from the claims-based authz registry. */
  readonly requiredPolicy?: string;
  /** Feature-flag key resolved at render time. */
  readonly featureFlag?: string;
  /** ANY-of role match. Empty array = no role gate. */
  readonly roles?: readonly string[];
}

/**
 * Visual badge that decorates a nav / footer item. Severity-driven so the
 * renderer maps to the host UI library's badge severity vocabulary
 * (PrimeNG: `info` / `success` / `warning` / `danger` / `secondary`).
 */
export interface NavBadge {
  /** Display value — number renders as digits; "Live", "Beta", "New" common for strings. */
  readonly value: string | number;
  /** Drives the colour palette. Pulse only honoured by some renderers (e.g. Live). */
  readonly variant: 'info' | 'success' | 'warning' | 'danger' | 'secondary';
  /** When true the badge pulses — use sparingly (live data, breaking news). */
  readonly pulse?: boolean;
}

/**
 * One platform-language option exposed by the language switcher widget.
 * `code` is BCP-47 (`en`, `en-US`, `fr-CA`); `flagEmoji` is decorative
 * (don't use as the only language indicator — accessibility).
 */
export interface LanguageOption {
  /** BCP-47 code. */
  readonly code: string;
  /** User-facing label (in the target language ideally — "Français", not "French"). */
  readonly label: string;
  /** Optional decorative flag glyph. */
  readonly flagEmoji?: string;
}

/**
 * Tenant entry in the tenant switcher dropdown. `id` is opaque (back-end
 * tenant id); `domain` (when present) lets the switcher show the
 * tenant-scoped public URL inline.
 */
export interface TenantOption {
  readonly id: string;
  readonly displayName: string;
  /** Tenant-scoped slug / subdomain. Optional. */
  readonly domain?: string;
  /** Optional environment label per tenant (some tenants run on staging). */
  readonly envBadge?: EnvBadge;
}

/** Environment ribbon shown next to the brand mark. `production` means hide. */
export type EnvBadge = 'dev' | 'staging' | 'uat' | 'production';

/**
 * Authenticated user shape consumed by the user-menu trigger + bell + chrome
 * widgets. Lives here (not under auth/) because the chrome contract needs to
 * stay independent of any specific auth provider — the shell adapts the
 * AuthService output into this shape.
 */
export interface UserProfile {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly avatarUrl?: string | null;
  /** Display role label (e.g. "Cardiology · Attending"). */
  readonly role?: string;
  /** Active tenant / org name shown in the user-menu header row. */
  readonly orgName?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Nav menu items
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Match strategy for highlighting the active top-level nav item. `prefix`
 * matches `/users/123` against `/users`; `exact` requires literal equality.
 * `prefix-with-redirect` is the prefix variant that ALSO highlights when the
 * URL is the parent's index redirect target (`/` → `/dashboard` highlights
 * Dashboard).
 */
export type NavActiveMatchStrategy = 'exact' | 'prefix' | 'prefix-with-redirect';

/**
 * One leaf row inside a {@link NavMenuSection} (mega menu only). Same shape
 * as {@link NavMenuItem} minus the `children` field — leaf rows can't open
 * further submenus.
 */
export interface NavMenuLeaf {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconClass;
  readonly routePath?: RoutePath;
  readonly externalUrl?: string;
  readonly badge?: NavBadge;
  readonly permission?: NavPermission;
  readonly analyticsTag?: string;
  readonly disabled?: boolean;
  readonly tooltip?: string;
  /** Short description shown under the label in mega-menu rows. */
  readonly description?: string;
}

/**
 * One column in a mega menu, with its own heading and a list of leaf rows.
 * The `mega` menu variant lays sections out as a CSS grid; section count
 * usually drives column count (renderer caps to a sensible max).
 */
export interface NavMenuSection {
  /** Column heading shown above the leaves (uppercase + tracking-wide by convention). */
  readonly heading: string;
  /** Optional helper text under the heading. Single line. */
  readonly subheading?: string;
  readonly leaves: readonly NavMenuLeaf[];
}

/**
 * One item in the centre nav (top-level). `children` is the discriminator
 * that flips the renderer between flat-link and dropdown/mega-panel modes:
 *
 *   - children undefined   → flat link (uses `routePath` or `externalUrl`)
 *   - children present     → opens an overlay panel populated from the sections
 *
 * `analyticsTag`, when present, makes the item also emit a `NavActionEvent`
 * with `source: 'menu'` on click — the shell decides whether to forward to
 * a telemetry pipeline.
 */
export interface NavMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconClass;
  /** Set when `children` is undefined; ignored otherwise. */
  readonly routePath?: RoutePath;
  /** Set when the link should leave the SPA. Mutually exclusive with `routePath`. */
  readonly externalUrl?: string;
  readonly badge?: NavBadge;
  readonly permission?: NavPermission;
  /** Set for mega-menu items. Each section becomes a column. */
  readonly children?: readonly NavMenuSection[];
  readonly analyticsTag?: string;
  readonly disabled?: boolean;
  readonly tooltip?: string;
}

/**
 * Visual variant for the center menu.
 *
 * VARIANT SEMANTICS
 *   - 'flat'    — horizontal list of links + dropdowns (top-bar default)
 *   - 'mega'    — horizontal list; items with children open mega-overlay
 *   - 'icon'    — horizontal icon-only buttons with pTooltip labels
 *   - 'tabs'    — horizontal links with bottom-border active indicator
 *   - 'sidebar' — VERTICAL rail rendered by `<app-platform-side-nav>` (NOT
 *                 inside the top bar). When this variant is set, the top
 *                 navbar hides its center menu and shows a hamburger that
 *                 toggles `SidenavStateService.collapsed()`. Children of
 *                 sidebar items render as inline accordions when expanded
 *                 and as a click-triggered flyout popover when collapsed.
 */
export type NavMenuVariant = 'flat' | 'mega' | 'icon' | 'tabs' | 'sidebar';

/** Top-level config for the centre nav zone. */
export interface NavMenuConfig {
  readonly variant: NavMenuVariant;
  readonly items: readonly NavMenuItem[];
  /**
   * How to decide which top-level item is "active". Renderer applies the
   * matching CSS class (`nav-menu__item--active` per BEM).
   */
  readonly activeMatchStrategy: NavActiveMatchStrategy;
  /**
   * Viewport width (px) below which the centre nav collapses behind the
   * mobile hamburger. Renderer uses CSS media queries — no `*ngIf`.
   * Defaults applied per variant when omitted (renderer concern).
   */
  readonly collapseBreakpoint?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Left zone: brand chrome + tenant switcher
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Brand mark + product name + optional sub-label + env badge + home link.
 * `imageSrc` wins over `brandName` when set; `alt` is required either way
 * (WCAG 1.1.1 — every image needs an alt; in our case it doubles as the
 * accessible label for the home link).
 */
export interface NavLogoConfig {
  /** Bitmap / SVG URL. Renderer adds width + height + loading lazy/eager per spec. */
  readonly imageSrc?: string;
  /** REQUIRED — accessible label for the home link, alt text when imageSrc set. */
  readonly alt: string;
  /** Text product name shown next to the logo when imageSrc absent OR as a complement. */
  readonly brandName?: string;
  /** Subtitle below the brand name (tenant name, "Workspace" etc.). */
  readonly subLabel?: string;
  /** Where the logo links to. Defaults to '/' when not set. */
  readonly homeRoute: RoutePath;
  /** Environment ribbon. Renderer hides when value is `'production'`. */
  readonly envBadge?: EnvBadge;
}

/** Tenant switcher dropdown widget config. */
export interface NavTenantSwitcherConfig {
  readonly enabled: boolean;
  readonly currentTenant: TenantOption;
  readonly availableTenants: readonly TenantOption[];
  /** Permission that gates the WHOLE switcher, not individual tenants. */
  readonly permission?: NavPermission;
}

/** Composite for the left zone. */
export interface NavLeftZoneConfig {
  readonly logo: NavLogoConfig;
  readonly tenantSwitcher?: NavTenantSwitcherConfig;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Right zone widgets
// ═══════════════════════════════════════════════════════════════════════════════

/** Discriminator on every right-zone widget so the renderer can no-op cleanly. */
export interface NavRightZoneWidgetBase {
  readonly enabled: boolean;
  readonly permission?: NavPermission;
}

// ── Clock ─────────────────────────────────────────────────────────────────
/**
 * IANA-timezone live clock. `format` controls the displayed string only;
 * the underlying value is always in `timezone` so screen readers announce
 * unambiguously.
 */
export interface NavClockConfig extends NavRightZoneWidgetBase {
  /** IANA tz database name (e.g. `'America/New_York'`). Defaults to browser tz. */
  readonly timezone?: string;
  readonly format: '12h' | '24h';
  /** Show timezone abbreviation next to the time. Default true. */
  readonly showTimezone?: boolean;
}

// ── Market status (Finance) ───────────────────────────────────────────────
export interface MarketDescriptor {
  readonly symbol: string;
  readonly label: string;
  readonly tradingHours?: { readonly open: string; readonly close: string };
}
export interface NavMarketStatusConfig extends NavRightZoneWidgetBase {
  readonly markets?: readonly MarketDescriptor[];
}

// ── Shift status (Healthcare / HR) ────────────────────────────────────────
export interface NavShiftStatusConfig extends NavRightZoneWidgetBase {
  /** Override the renderer's default label ("On duty" / "Off duty"). */
  readonly label?: string;
}

// ── Global search ─────────────────────────────────────────────────────────
export interface NavGlobalSearchConfig extends NavRightZoneWidgetBase {
  readonly placeholder?: string;
  /** Where to navigate on submit when not in command-palette mode. */
  readonly searchRoute?: RoutePath;
  /**
   * When true, clicking opens the command palette (Ctrl/Cmd+K) instead of a
   * navigation. Renderer registers a global hotkey when this is set.
   */
  readonly commandPaletteMode?: boolean;
}

// ── AI assistant ──────────────────────────────────────────────────────────
export interface NavAiAssistantConfig extends NavRightZoneWidgetBase {
  readonly label?: string;
  readonly icon?: IconClass;
  /** Stable key emitted on the NavActionEvent so the host can dispatch. */
  readonly actionKey: string;
}

// ── Quick actions ─────────────────────────────────────────────────────────
export interface QuickAction {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconClass;
  /** Stable key emitted on the NavActionEvent. */
  readonly actionKey: string;
  readonly permission?: NavPermission;
  readonly badge?: NavBadge;
  /** Optional keyboard shortcut text (display only — host registers the binding). */
  readonly shortcut?: string;
}
export interface NavQuickActionsConfig extends NavRightZoneWidgetBase {
  readonly label?: string;
  readonly icon?: IconClass;
  readonly actions: readonly QuickAction[];
}

// ── Messages + Notifications ──────────────────────────────────────────────
/**
 * Both messages and notifications have the same shape because both are bell
 * + popover + count-badge variants — the only difference is the data feed
 * and the route the "View all" link points to.
 */
export interface NavBellWidgetConfig extends NavRightZoneWidgetBase {
  /** Cap the badge label ("99+" by convention). */
  readonly maxBadgeCount?: number;
  readonly viewAllRoute?: RoutePath;
}

// ── Help ──────────────────────────────────────────────────────────────────
export interface NavHelpConfig extends NavRightZoneWidgetBase {
  readonly docsUrl?: string;
  readonly label?: string;
  readonly icon?: IconClass;
}

// ── Theme toggle ──────────────────────────────────────────────────────────
export interface NavThemeToggleConfig extends NavRightZoneWidgetBase {
  /** When true, "System" is one of the cycled options (default true). */
  readonly includeSystem?: boolean;
}

// ── Language switcher ─────────────────────────────────────────────────────
export interface NavLanguageSwitcherConfig extends NavRightZoneWidgetBase {
  readonly languages: readonly LanguageOption[];
}

// ── User menu ─────────────────────────────────────────────────────────────
/**
 * Menu rows in the user-menu dropdown. Discriminated by `kind` so the
 * renderer doesn't have to guess what to draw.
 *
 *   - `'link'`    — RouterLink row
 *   - `'divider'` — visual separator (no other fields)
 *   - `'action'`  — emits `NavActionEvent` with `source: 'userMenu'` on click
 *
 * `isLogout: true` marks the row that triggers `(logout)` — surfaces the
 * standard Sign Out treatment (red text, separator above) without leaking
 * "logout" through every domain's config.
 */
export type UserMenuItem =
  | UserMenuLink
  | UserMenuDivider
  | UserMenuAction;

interface UserMenuItemBase {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconClass;
  readonly permission?: NavPermission;
  readonly disabled?: boolean;
}

export interface UserMenuLink extends UserMenuItemBase {
  readonly kind: 'link';
  readonly routePath?: RoutePath;
  readonly externalUrl?: string;
}

export interface UserMenuDivider {
  readonly kind: 'divider';
  readonly id: string;
}

export interface UserMenuAction extends UserMenuItemBase {
  readonly kind: 'action';
  readonly actionKey: string;
  /** When true this row is the Sign Out row — shell wires (logout) instead of (navAction). */
  readonly isLogout?: boolean;
}

export interface NavUserMenuConfig {
  readonly enabled: boolean;
  /** Show the display name next to the avatar in the trigger button. */
  readonly showNameInHeader: boolean;
  /** Show the role label under the display name in the trigger button. */
  readonly showRoleInHeader: boolean;
  readonly menuItems: readonly UserMenuItem[];
}

/**
 * Composite for the right zone. Every widget except `userMenu` is optional
 * — domains opt in by setting `enabled: true` on the ones they want.
 *
 * RENDER ORDER (left → right) is fixed by the spec so cross-domain users
 * always know where to look:
 *   clock → marketStatus → shiftStatus → globalSearch → aiAssistant
 *   → quickActions → messages → notifications → help → themeToggle
 *   → languageSwitcher → userMenu (or login button when no userProfile)
 *   → hamburger (mobile only)
 */
export interface NavRightZoneConfig {
  readonly clock?: NavClockConfig;
  readonly marketStatus?: NavMarketStatusConfig;
  readonly shiftStatus?: NavShiftStatusConfig;
  readonly globalSearch?: NavGlobalSearchConfig;
  readonly aiAssistant?: NavAiAssistantConfig;
  readonly quickActions?: NavQuickActionsConfig;
  readonly messages?: NavBellWidgetConfig;
  readonly notifications?: NavBellWidgetConfig;
  readonly help?: NavHelpConfig;
  readonly themeToggle?: NavThemeToggleConfig;
  readonly languageSwitcher?: NavLanguageSwitcherConfig;
  /** Required because the chrome always either shows the user menu or a Login button. */
  readonly userMenu: NavUserMenuConfig;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Top-level NavbarConfig
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Whole-navbar config. One per domain. The shell composes this with the
 * authenticated `UserProfile` + a notifications signal at runtime; the
 * config itself is DOMAIN data, not USER data.
 *
 * STICKY + GLASS MORPHISM
 *   Renderer-level chrome behaviours, kept here so domains can disable them
 *   per surface (e.g. login pages where the navbar isn't even rendered).
 */
export interface NavbarConfig {
  readonly leftZone: NavLeftZoneConfig;
  readonly centerZone: { readonly menu: NavMenuConfig };
  readonly rightZone: NavRightZoneConfig;
  /** When true the navbar uses `position: sticky; top: 0`. Default true. */
  readonly sticky?: boolean;
  /**
   * When true AND `sticky` is true, the navbar surface uses backdrop-blur
   * + semi-transparent fill once the user scrolls past the bar's height.
   * Renderer attaches the scroll listener; CSS does the rest.
   */
  readonly glassMorphism?: boolean;
  /** Fixed bar height (default 64 px). Renderer exposes via `--nav-height`. */
  readonly heightPx?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — Footer
// ═══════════════════════════════════════════════════════════════════════════════
//
// The footer is a composable list of optional section blocks. The renderer
// stamps each block in a fixed visual order; domains opt into whichever
// blocks they need by populating the corresponding field. This generalises
// to public-sector / agency / consumer footers as well as the standard
// SaaS "logo + columns + newsletter + bottom bar" arrangement.
//
// VISUAL ORDER (top → bottom)
//   1. brand + social + columns + newsletter   (responsive row)
//   2. accreditation                           (centered badge + caption)
//   3. compliance                              (badges + disclaimer)
//   4. utilityBar                              (hairline-separated links row)
//   5. copyright                               (centered)
//   6. meta                                    (version / build / status pill)
//   7. flag                                    (small image, e.g. country flag)
//
// `variant` is a preset. `'full'` renders every populated block; `'minimal'`
// hides the top row + accreditation + meta + flag (compliance + utility +
// copyright remain); `'app'` collapses to copyright only. Domains override
// the preset by populating / nulling the relevant fields.

/** Single link in any footer block. */
export interface FooterLink {
  readonly label: string;
  readonly routePath?: RoutePath;
  readonly externalUrl?: string;
  readonly icon?: IconClass;
  readonly badge?: NavBadge;
}

/**
 * Column tone — drives the column's link styling.
 *   - `'default'`   neutral text-on-dark
 *   - `'highlight'` brand-accent (yellow) underlined links — used by public-
 *                   sector / agency footers to surface "important" link sets
 *                   (Privacy / FOI / Jobs etc.)
 */
export type FooterColumnTone = 'default' | 'highlight';

/** A column of footer links. Heading is optional — agency footers often omit. */
export interface FooterLinkColumn {
  readonly heading?: string;
  readonly tone?: FooterColumnTone;
  readonly links: readonly FooterLink[];
}

/**
 * Brand block — logo + optional tagline + optional multi-line address. The
 * address lines render in document order under the brand name; common use
 * cases are agency mailing addresses, regional HQ identifiers, etc.
 */
export interface FooterBrandConfig {
  readonly imageSrc?: string;
  readonly alt: string;
  readonly brandName?: string;
  readonly tagline?: string;
  readonly addressLines?: readonly string[];
  /** Optional home link — wraps the logo in an anchor when present. */
  readonly homeRoute?: RoutePath;
}

/** Newsletter sign-up widget shown in the footer top row. */
export interface FooterNewsletterConfig {
  readonly enabled: boolean;
  readonly heading?: string;
  readonly placeholder?: string;
  readonly submitLabel?: string;
  /** Action key emitted via `(navAction)` on submit; host owns the HTTP call. */
  readonly actionKey?: string;
  /** Confirmation copy shown after submit. Default "Thanks! Check your inbox to confirm." */
  readonly thanksMessage?: string;
}

/** Compliance certifications + legal disclaimer + cookie-consent prompt. */
export type ComplianceBadge =
  | 'soc2'
  | 'hipaa'
  | 'iso27001'
  | 'gdpr'
  | 'pci'
  | 'eeoc'
  | 'finra';

export interface FooterComplianceConfig {
  readonly badges?: readonly ComplianceBadge[];
  /** Long-form disclaimer body; renderer caps width to ~800 px. */
  readonly disclaimer?: string;
  /** When true, render the dismissible cookie-consent bar. */
  readonly cookieConsent?: boolean;
  /** Optional content overrides for the cookie-consent bar. */
  readonly cookieConsentLabels?: FooterCookieConsentLabels;
}

/**
 * Optional content overrides for the cookie-consent bar. Every field has
 * a sensible English default in the renderer; supply only the strings you
 * need to localise / re-word.
 */
export interface FooterCookieConsentLabels {
  /** Body copy. Default: standard "We use cookies…" sentence. */
  readonly body?: string;
  readonly acceptLabel?: string;
  readonly rejectLabel?: string;
  /** Inline policy link href. Defaults to `/cookies`. */
  readonly policyUrl?: string;
  readonly policyLabel?: string;
}

/** Social-media shortcut platforms. `rss` covers feed icons. */
export type SocialPlatform =
  | 'twitter'
  | 'linkedin'
  | 'github'
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'mastodon'
  | 'discord'
  | 'rss'
  | 'tiktok'
  | 'pinterest';

export interface SocialLink {
  readonly platform: SocialPlatform;
  readonly url: string;
  /** Optional override for the accessible label. Defaults to platform name. */
  readonly ariaLabel?: string;
}

/** Social-icon row with an optional heading next to the icons ("Follow Us:" etc). */
export interface FooterSocialConfig {
  readonly heading?: string;
  readonly links: readonly SocialLink[];
}

/**
 * Centered accreditation block — round badge image with caption. Common in
 * public-sector / healthcare footers (e.g. PHAB, accrediting bodies, ISO).
 * The badge can optionally link out (accreditor's site).
 */
export interface FooterAccreditationConfig {
  readonly imageSrc: string;
  readonly imageAlt: string;
  readonly caption?: string;
  /** Pixel width — height auto-scales. Defaults to 96 px. */
  readonly imageWidthPx?: number;
  readonly externalUrl?: string;
}

/**
 * Hairline-separated utility row — typically site-wide secondary links
 * (privacy / help / contact / accessibility / mobile-app downloads). One
 * line, evenly distributed; wraps on narrow viewports.
 */
export interface FooterUtilityBarConfig {
  readonly links: readonly FooterLink[];
}

/**
 * Centered copyright block. `text` overrides the default
 * "© {year} {owner}. All rights reserved." format when domains need a
 * different phrasing ("Copyright © 2026 State of South Carolina").
 */
export interface FooterCopyrightConfig {
  readonly owner: string;
  /** Default = current year. */
  readonly year?: number;
  /** Full override of the rendered string. */
  readonly text?: string;
}

/** Build / version / status-page row — secondary trust signal for SaaS. */
export interface FooterMetaConfig {
  readonly appVersion?: string;
  readonly buildId?: string;
  readonly statusPageUrl?: string;
  /** Status pill copy. Default "All systems operational". */
  readonly statusLabel?: string;
  readonly languageSwitcher?: NavLanguageSwitcherConfig;
}

/** Tiny image badge — country flag, accessibility seal, etc. */
export interface FooterFlagConfig {
  readonly imageSrc: string;
  readonly alt: string;
  readonly heightPx?: number;
}

/**
 * Footer variant — preset arrangement of which blocks render.
 *   - `'full'`    every populated block renders.
 *   - `'minimal'` brand row + accreditation + meta + flag suppressed.
 *   - `'app'`     copyright only (everything else suppressed).
 */
export type FooterVariant = 'full' | 'minimal' | 'app';

/**
 * Whole-footer config. Every section is optional including `copyright` —
 * the renderer falls back to `© {currentYear}` when absent. Reason: the
 * SPA hydrates from a wire response (BFF JSON) that may briefly emit the
 * legacy shape during a deployment, and a hard-required field would
 * crash the chrome on first paint instead of degrading gracefully.
 */
export interface FooterConfig {
  readonly variant: FooterVariant;
  readonly brand?: FooterBrandConfig;
  readonly social?: FooterSocialConfig;
  readonly columns?: readonly FooterLinkColumn[];
  readonly newsletter?: FooterNewsletterConfig;
  readonly accreditation?: FooterAccreditationConfig;
  readonly compliance?: FooterComplianceConfig;
  readonly utilityBar?: FooterUtilityBarConfig;
  readonly copyright?: FooterCopyrightConfig;
  readonly meta?: FooterMetaConfig;
  readonly flag?: FooterFlagConfig;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — Output events
// ═══════════════════════════════════════════════════════════════════════════════

/** Source slot that fired a `NavActionEvent` — drives the host's dispatcher. */
export type NavActionSource =
  | 'menu'
  | 'quickAction'
  | 'userMenu'
  | 'aiAssistant'
  | 'notification'
  | 'message'
  | 'help'
  | 'newsletter';

/**
 * Every action surface (quick action, user-menu action row, AI button, etc.)
 * funnels through this single event so the host has a single dispatcher
 * instead of N (output) bindings.
 *
 *   shell.onNavAction({ source, actionKey, payload }) {
 *     switch (actionKey) { … }
 *   }
 */
export interface NavActionEvent {
  readonly source: NavActionSource;
  readonly actionKey: string;
  /** Optional payload carried with the event (e.g. clicked notification id). */
  readonly payload?: Readonly<Record<string, unknown>>;
}

/** Tenant-switcher selection event — host owns the tenant-flush + reload. */
export interface NavTenantSwitchEvent {
  readonly fromTenantId: string;
  readonly toTenantId: string;
}

/** Global-search submit event. */
export interface NavSearchEvent {
  readonly query: string;
}

/** Sign-out event. Carries the user id for telemetry (NOT for credentials). */
export interface NavLogoutEvent {
  readonly userId: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — Notification + message DTOs (consumed by bell widgets)
// ═══════════════════════════════════════════════════════════════════════════════

/** Severity for a notification or message. Drives icon + colour mapping. */
export type NavNotificationLevel = 'info' | 'success' | 'warning' | 'critical';

/**
 * Richer than the legacy `NavNotification` (under `shared/components/navigation`).
 * Keeps every field the spec D5 popover renders (level, deepLink, actor) so
 * the host only needs to map its DTO once.
 */
export interface NavNotification {
  readonly id: string;
  readonly level: NavNotificationLevel;
  readonly title: string;
  readonly message?: string;
  /** ISO-8601 timestamp; renderer formats relatively + via DatePipe. */
  readonly createdAt: string;
  readonly read: boolean;
  /** Optional deep link the host navigates to on click. */
  readonly deepLink?: RoutePath;
  /** Display name of the actor that triggered the notification (if any). */
  readonly actor?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — Module + variant convenience types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Whole-app chrome — navbar + footer pair. Returned by the BFF in the
 * `chrome` field of `SessionInfo` (see `core/auth/auth.service.ts`); the
 * SPA's `NavbarConfigService` hydrates from this exact shape.
 *
 * Single chrome per deployment — no domain switching machinery exists on the
 * wire or in the SPA. Phase 2 will filter the contained `NavMenuItem[]` per
 * user / role server-side; the type stays the same.
 */
export interface ChromeConfig {
  readonly navbar: NavbarConfig;
  readonly footer: FooterConfig;
}

/**
 * Re-export so consumers don't need to import `Routes` directly when they
 * type a feature module's route exports — keeps F.6's domain modules from
 * pulling `@angular/router` purely for the type ref.
 */
export type { Routes };
