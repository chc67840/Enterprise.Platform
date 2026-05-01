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
      // 'sidebar' renders the menu vertically in `<app-platform-side-nav>`
      // and the top bar shows a hamburger toggle. See the variant doc on
      // NavMenuVariant for the full state matrix.
      variant: 'sidebar',
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
        {
          id: 'ui-demo',
          label: 'UI Demo',
          icon: 'pi pi-palette',
          routePath: '/demo/ui-kit',
          analyticsTag: 'nav.uiDemo',
          tooltip: 'Reference catalogue — every UI Kit primitive with all variants',
          children: [
            {
              heading: 'Overview',
              subheading: 'Get started',
              leaves: [
                { id: 'ui-kit-home',    label: 'Overview',      icon: 'pi pi-th-large',        routePath: '/demo/ui-kit',                description: 'Landing — every category at a glance' },
                { id: 'ui-kit-sink',    label: 'Kitchen Sink',  icon: 'pi pi-objects-column', routePath: '/demo/ui-kit/kitchen-sink',   description: 'All primitives on a single page' },
                { id: 'ui-kit-tokens',  label: 'Design Tokens', icon: 'pi pi-palette',         routePath: '/demo/ui-kit/tokens',         description: 'Color · spacing · density · motion' },
              ],
            },
            {
              heading: 'Forms & Inputs',
              subheading: 'Build any form fast',
              leaves: [
                { id: 'ui-kit-button',  label: 'Buttons',     icon: 'pi pi-bolt',     routePath: '/demo/ui-kit/button',      description: '7 variants × 5 sizes + states' },
                { id: 'ui-kit-input',   label: 'Inputs',      icon: 'pi pi-pencil',   routePath: '/demo/ui-kit/input',       description: 'Text · email · password · textarea' },
                { id: 'ui-kit-form',    label: 'Form Layout', icon: 'pi pi-th-large', routePath: '/demo/ui-kit/form-layout', description: 'Grid / inline / wizard layouts' },
                { id: 'ui-kit-schema',  label: 'Schema Form', icon: 'pi pi-clone',    routePath: '/demo/ui-kit/schema-form', description: 'Declarative — schema → typed FormGroup' },
                { id: 'ui-kit-file',    label: 'File Upload', icon: 'pi pi-paperclip',routePath: '/demo/ui-kit/file',        description: 'Dropzone / button + preview' },
              ],
            },
            {
              heading: 'Components',
              subheading: 'Display, navigation, overlays',
              leaves: [
                { id: 'ui-kit-table',    label: 'Data Table',       icon: 'pi pi-table',           routePath: '/demo/ui-kit/data-table', description: '17 cell types · multi-sort · async' },
                { id: 'ui-kit-chart',    label: 'Charts',           icon: 'pi pi-chart-bar',       routePath: '/demo/ui-kit/chart',      description: 'Theme-aware Chart.js wrapper' },
                { id: 'ui-kit-overlay',  label: 'Overlays',         icon: 'pi pi-window-restore',  routePath: '/demo/ui-kit/overlay',    description: 'Dialog · Drawer · Popover · Tooltip' },
                { id: 'ui-kit-confirm',  label: 'Confirm Dialog',   icon: 'pi pi-question-circle', routePath: '/demo/ui-kit/confirm',    description: 'Promise-based ask() / askDestructive()' },
                { id: 'ui-kit-message',  label: 'Messages + Toast', icon: 'pi pi-comment',         routePath: '/demo/ui-kit/message',    description: 'Inline · toast · banners' },
                { id: 'ui-kit-list',     label: 'Lists',            icon: 'pi pi-list',            routePath: '/demo/ui-kit/list',       description: 'Simple · selectable · checklist' },
                { id: 'ui-kit-tree',     label: 'Trees',            icon: 'pi pi-sitemap',         routePath: '/demo/ui-kit/tree',       description: 'Hierarchical with selection · filter' },
                { id: 'ui-kit-panel',    label: 'Panels',           icon: 'pi pi-window-maximize', routePath: '/demo/ui-kit/panel',      description: 'Cards: default · elevated · flat · ghost' },
                { id: 'ui-kit-media',    label: 'Media',            icon: 'pi pi-image',           routePath: '/demo/ui-kit/media',      description: 'Image · Avatar · Gallery' },
                { id: 'ui-kit-menu',     label: 'Menus',            icon: 'pi pi-bars',            routePath: '/demo/ui-kit/menu',       description: 'Dropdown · Context' },
                { id: 'ui-kit-steps',    label: 'Steps + Wizard',   icon: 'pi pi-step-forward',    routePath: '/demo/ui-kit/steps',      description: '8 variants · sub-steps · validation' },
              ],
            },
          ],
        },
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
  brand: {
    imageSrc: '/rounded_logo_svg.svg',
    alt: 'Enterprise Platform',
    brandName: 'Enterprise Platform',
    tagline: 'Workspace',
    addressLines: [
      'Enterprise Platform HQ',
      '400 Otarre Parkway',
      'Cayce, SC 29033',
    ],
    homeRoute: '/dashboard',
  },
  social: {
    heading: 'Follow Us:',
    links: [
      { platform: 'facebook', url: 'https://facebook.com/enterprise-platform' },
      { platform: 'linkedin', url: 'https://linkedin.com/company/enterprise-platform' },
      { platform: 'rss',      url: 'https://example.com/feed.xml' },
      { platform: 'twitter',  url: 'https://twitter.com/enterprise_platform' },
      { platform: 'youtube',  url: 'https://youtube.com/@enterprise-platform' },
    ],
  },
  columns: [
    {
      tone: 'highlight',
      links: [
        { label: 'News',          externalUrl: 'https://example.com/news' },
        { label: 'Contact Us',    externalUrl: 'https://example.com/contact' },
        { label: 'Pay an Invoice', externalUrl: 'https://example.com/billing' },
      ],
    },
    {
      tone: 'highlight',
      links: [
        { label: 'Privacy Policy & Accessibility', externalUrl: 'https://example.com/privacy' },
        { label: 'Request Public Records (FOI)',   externalUrl: 'https://example.com/foi' },
        { label: 'Jobs & Careers',                 externalUrl: 'https://example.com/careers' },
      ],
    },
  ],
  accreditation: {
    imageSrc: '/rounded_logo_svg.svg',
    imageAlt: 'Accredited platform — verified by an independent body',
    caption: 'Enterprise Platform is an independently accredited platform for enterprise workloads.',
    imageWidthPx: 96,
  },
  compliance: {
    badges: ['soc2', 'gdpr'],
    cookieConsent: true,
  },
  utilityBar: {
    links: [
      { label: 'Home',                  routePath: '/' },
      { label: 'Privacy & Security',    externalUrl: 'https://example.com/privacy' },
      { label: 'Help Center',           externalUrl: 'https://example.com/help' },
      { label: 'Contact',               externalUrl: 'https://example.com/contact' },
      { label: 'Download Adobe Reader', externalUrl: 'https://get.adobe.com/reader/' },
    ],
  },
  copyright: {
    owner: 'Enterprise Platform Inc.',
    text: `Copyright © ${new Date().getFullYear()} Enterprise Platform Inc.`,
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
    copyright: { owner: 'Enterprise Platform Inc.' },
  },
};
