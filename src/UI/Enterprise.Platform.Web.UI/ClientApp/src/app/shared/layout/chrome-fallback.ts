/**
 * ─── shared/layout/chrome-fallback.ts ───────────────────────────────────────────
 *
 * Offline / first-paint chrome used when `GET /api/auth/session` hasn't
 * returned yet (or returned an error). The shape mirrors what the BFF's
 * `StaticChromeBuilder` (see `Services/Chrome/StaticChromeBuilder.cs`) emits
 * — keep this file in lock-step with that builder so the SPA renders the
 * same shell whether the response is server-driven or local-fallback.
 *
 * WHEN THIS RUNS
 *   - Cold-boot before `AuthService.refreshSession()` resolves
 *   - When the session call errored AND no `lastKnown` snapshot exists
 *
 * The SPA never calls a per-domain factory anymore — single deployment =
 * single chrome. If the deployment's branding diverges from this fallback,
 * edit the BFF's `StaticChromeBuilder` AND this constant together; the
 * contract test pins the wire shape, not the content.
 */
import type { ChromeConfig, FooterConfig, NavbarConfig } from './models/nav.models';

const NAVBAR: NavbarConfig = {
  leftZone: {
    logo: {
      // Served from `ClientApp/public/logo.svg` — Angular's `assets[]` glob
      // (`{ "input": "public", "glob": "**/*" }`) copies it to the deployment
      // root. Files placed under `src/assets/` are NOT picked up — that path
      // isn't in the build config (this is the modern Angular CLI convention).
      imageSrc: '/rounded_logo_svg.svg',
      alt: 'Enterprise Platform — home',
      brandName: 'Enterprise Platform',
      subLabel: 'Workspace',
      homeRoute: '/dashboard',
      envBadge: 'staging',
    },
  },
  centerZone: {
    menu: {
      variant: 'flat',
      activeMatchStrategy: 'prefix-with-redirect',
      collapseBreakpoint: 1024,
      items: [
        { id: 'dash', label: 'Dashboard', icon: 'pi pi-home', routePath: '/dashboard' },
        {
          id: 'users',
          label: 'Users',
          icon: 'pi pi-users',
          routePath: '/users',
          permission: { requiredPolicy: 'users.read' },
          analyticsTag: 'nav.users',
        },
        { id: 'reports',  label: 'Reports',  icon: 'pi pi-chart-bar', routePath: '/reports' },
        { id: 'settings', label: 'Settings', icon: 'pi pi-cog',       routePath: '/settings' },
      ],
    },
  },
  rightZone: {
    clock: { enabled: true, format: '24h', showTimezone: true },
    globalSearch: { enabled: true, placeholder: 'Search…', commandPaletteMode: true },
    notifications: { enabled: true, maxBadgeCount: 99, viewAllRoute: '/notifications' },
    help: { enabled: true, label: 'Help' },
    themeToggle: { enabled: true, includeSystem: true },
    userMenu: {
      enabled: true,
      showNameInHeader: true,
      showRoleInHeader: false,
      menuItems: [
        { kind: 'link',   id: 'profile', label: 'Profile',      icon: 'pi pi-user',         routePath: '/profile' },
        { kind: 'link',   id: 'org',     label: 'Organization', icon: 'pi pi-building',     routePath: '/organization' },
        { kind: 'link',   id: 'billing', label: 'Billing',      icon: 'pi pi-credit-card',  routePath: '/billing' },
        { kind: 'divider', id: 'div-1' },
        { kind: 'action', id: 'shortcuts', label: 'Keyboard shortcuts', icon: 'pi pi-keyboard', actionKey: 'help.shortcuts' },
        { kind: 'action', id: 'whats-new', label: "What's new",         icon: 'pi pi-star',     actionKey: 'help.whatsNew' },
        { kind: 'divider', id: 'div-2' },
        { kind: 'action', id: 'sign-out',  label: 'Sign out',           icon: 'pi pi-sign-out', actionKey: 'auth.logout', isLogout: true },
      ],
    },
  },
  sticky: true,
  glassMorphism: true,
  heightPx: 64,
};

const FOOTER: FooterConfig = {
  variant: 'full',
  logo: { alt: 'Enterprise Platform', brandName: 'Enterprise Platform' },
  tagline: 'Workspace',
  columns: [
    {
      heading: 'Product',
      links: [
        { label: 'Dashboard', routePath: '/dashboard' },
        { label: 'Users',     routePath: '/users' },
        { label: 'Reports',   routePath: '/reports' },
      ],
    },
    {
      heading: 'Support',
      links: [
        { label: 'Help',    externalUrl: 'https://docs.example.com' },
        { label: 'Contact', externalUrl: 'mailto:support@example.com' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { label: 'Privacy', externalUrl: 'https://example.com/privacy' },
        { label: 'Terms',   externalUrl: 'https://example.com/terms' },
      ],
    },
  ],
  compliance: {
    badges: ['soc2', 'gdpr'],
    cookieConsent: true,
  },
  bottomBar: {
    copyrightOwner: 'Enterprise Platform Inc.',
    links: [
      { label: 'Privacy',       externalUrl: 'https://example.com/privacy' },
      { label: 'Terms',         externalUrl: 'https://example.com/terms' },
      { label: 'Accessibility', externalUrl: 'https://example.com/accessibility' },
    ],
  },
};

/** The single fallback chrome used when the BFF response isn't yet available. */
export const STATIC_FALLBACK_CHROME: ChromeConfig = { navbar: NAVBAR, footer: FOOTER };

/**
 * Minimal "safe chrome" rendered when `/api/auth/session` fails before first
 * paint AND no last-known snapshot exists. Logo + sign-out + a status banner
 * surfaced via the host shell — nothing else. The user has just enough chrome
 * to recover (retry, or sign back in).
 */
export const MINIMAL_FALLBACK_CHROME: ChromeConfig = {
  navbar: {
    leftZone: {
      logo: {
        alt: 'Enterprise Platform — home',
        brandName: 'Enterprise Platform',
        homeRoute: '/',
      },
    },
    centerZone: { menu: { variant: 'flat', activeMatchStrategy: 'exact', items: [] } },
    rightZone: {
      userMenu: {
        enabled: true,
        showNameInHeader: false,
        showRoleInHeader: false,
        menuItems: [
          { kind: 'action', id: 'sign-out', label: 'Sign out', icon: 'pi pi-sign-out', actionKey: 'auth.logout', isLogout: true },
        ],
      },
    },
    sticky: true,
    heightPx: 64,
  },
  footer: {
    variant: 'app',
    bottomBar: { copyrightOwner: 'Enterprise Platform Inc.' },
  },
};
