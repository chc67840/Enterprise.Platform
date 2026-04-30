/**
 * ─── nav.models.spec.ts ─────────────────────────────────────────────────────────
 *
 * Compile-time type contract verification. **No runtime assertions** —
 * vitest just needs the file to compile under `strict: true`. If the spec
 * (`nav.models.ts`) drifts in a way that breaks any of the literal configs
 * below, `ng build` fails with a clear TS error pointing at the spec line.
 *
 * Why a `.spec.ts` and not a `.ts`?
 *   - Vitest discovers + compiles it as part of the unit-test sweep, so type
 *     drift surfaces in CI without an extra MSBuild target.
 *   - `expect(true).toBe(true)` at the bottom keeps vitest from reporting
 *     "no tests in file" (would fail the suite under `--passWithNoTests=false`).
 *
 * Pattern: `const _example: SomeType = { … } satisfies SomeType;`
 *   The `satisfies` operator (TS 4.9+) gives us excess-property checks AND
 *   inference, so a renamed field on the type AND a misspelled key on the
 *   literal both error.
 */
import { describe, expect, it } from 'vitest';

import type {
  ComplianceBadge,
  ChromeConfig,
  FooterConfig,
  NavActionEvent,
  NavbarConfig,
  NavMenuItem,
  NavNotification,
  NavRightZoneConfig,
  NavSearchEvent,
  NavTenantSwitchEvent,
  UserMenuItem,
  UserProfile,
} from './nav.models';

// ───────────────────────────────────────────────────────────────────────────────
// 1. NavMenuItem — every variant
// ───────────────────────────────────────────────────────────────────────────────

const _flatLink: NavMenuItem = {
  id: 'dashboard',
  label: 'Dashboard',
  icon: 'pi pi-home',
  routePath: '/dashboard',
} satisfies NavMenuItem;

const _flatLinkArraySegments: NavMenuItem = {
  id: 'tenant-page',
  label: 'Tenant',
  routePath: ['/tenants', 'acme', 'overview'] as const,
} satisfies NavMenuItem;

const _externalLink: NavMenuItem = {
  id: 'docs',
  label: 'Docs',
  externalUrl: 'https://docs.example.com',
} satisfies NavMenuItem;

const _withBadge: NavMenuItem = {
  id: 'signals',
  label: 'Signals',
  routePath: '/signals',
  badge: { value: 'Live', variant: 'danger', pulse: true },
} satisfies NavMenuItem;

const _withPermission: NavMenuItem = {
  id: 'records',
  label: 'Records',
  routePath: '/records',
  permission: {
    requiredPolicy: 'records.read',
    roles: ['clinician', 'admin'],
    featureFlag: 'records.v2',
  },
} satisfies NavMenuItem;

const _megaMenuItem: NavMenuItem = {
  id: 'analytics',
  label: 'Analytics',
  icon: 'pi pi-chart-bar',
  children: [
    {
      heading: 'Performance',
      subheading: 'Trade + signal performance',
      leaves: [
        { id: 'analytics.pl', label: 'P&L', routePath: '/analytics/pl' },
        { id: 'analytics.win', label: 'Win Rate', routePath: '/analytics/win-rate' },
      ],
    },
    {
      heading: 'Risk',
      leaves: [
        { id: 'analytics.draw', label: 'Drawdown', routePath: '/analytics/drawdown' },
        { id: 'analytics.var', label: 'VaR', routePath: '/analytics/var' },
      ],
    },
  ],
} satisfies NavMenuItem;

// ───────────────────────────────────────────────────────────────────────────────
// 2. UserMenuItem — every kind
// ───────────────────────────────────────────────────────────────────────────────

const _userMenuLink: UserMenuItem = {
  kind: 'link',
  id: 'profile',
  label: 'Profile',
  icon: 'pi pi-user',
  routePath: '/profile',
} satisfies UserMenuItem;

const _userMenuDivider: UserMenuItem = {
  kind: 'divider',
  id: 'div-1',
} satisfies UserMenuItem;

const _userMenuActionLogout: UserMenuItem = {
  kind: 'action',
  id: 'sign-out',
  label: 'Sign out',
  icon: 'pi pi-sign-out',
  actionKey: 'auth.logout',
  isLogout: true,
} satisfies UserMenuItem;

const _userMenuActionShortcuts: UserMenuItem = {
  kind: 'action',
  id: 'shortcuts',
  label: 'Keyboard shortcuts',
  actionKey: 'help.shortcuts',
} satisfies UserMenuItem;

// ───────────────────────────────────────────────────────────────────────────────
// 3. NavRightZoneConfig — every widget switched on
// ───────────────────────────────────────────────────────────────────────────────

const _rightZoneAllOn: NavRightZoneConfig = {
  clock: { enabled: true, timezone: 'America/New_York', format: '24h', showTimezone: true },
  marketStatus: {
    enabled: true,
    markets: [
      { symbol: 'NYSE', label: 'NYSE', tradingHours: { open: '09:30', close: '16:00' } },
    ],
  },
  shiftStatus: { enabled: true, label: 'On shift' },
  globalSearch: { enabled: true, placeholder: 'Search…', commandPaletteMode: true },
  aiAssistant: { enabled: true, label: 'Ask AI', icon: 'pi pi-sparkles', actionKey: 'ai.open' },
  quickActions: {
    enabled: true,
    label: 'Quick actions',
    actions: [
      { id: 'qa.trade', label: 'Log trade', icon: 'pi pi-plus', actionKey: 'trade.create', shortcut: 'Ctrl+T' },
    ],
  },
  messages: { enabled: true, maxBadgeCount: 99, viewAllRoute: '/messages' },
  notifications: { enabled: true, maxBadgeCount: 99, viewAllRoute: '/notifications' },
  help: { enabled: true, docsUrl: 'https://docs.example.com', label: 'Help' },
  themeToggle: { enabled: true, includeSystem: true },
  languageSwitcher: {
    enabled: true,
    languages: [
      { code: 'en', label: 'English', flagEmoji: '🇺🇸' },
      { code: 'es', label: 'Español', flagEmoji: '🇪🇸' },
    ],
  },
  userMenu: {
    enabled: true,
    showNameInHeader: true,
    showRoleInHeader: true,
    menuItems: [_userMenuLink, _userMenuDivider, _userMenuActionShortcuts, _userMenuActionLogout],
  },
} satisfies NavRightZoneConfig;

// ───────────────────────────────────────────────────────────────────────────────
// 4. NavbarConfig — composite with all sections wired
// ───────────────────────────────────────────────────────────────────────────────

const _navbarFlat: NavbarConfig = {
  leftZone: {
    logo: {
      alt: 'ManyMoney logo',
      brandName: 'ManyMoney',
      subLabel: 'Trader Workspace',
      homeRoute: '/dashboard',
      envBadge: 'staging',
    },
    tenantSwitcher: {
      enabled: true,
      currentTenant: { id: 't-1', displayName: 'Acme Capital' },
      availableTenants: [
        { id: 't-1', displayName: 'Acme Capital' },
        { id: 't-2', displayName: 'Beta Funds', envBadge: 'production' },
      ],
    },
  },
  centerZone: {
    menu: {
      variant: 'flat',
      activeMatchStrategy: 'prefix-with-redirect',
      collapseBreakpoint: 1024,
      items: [_flatLink, _withBadge, _megaMenuItem],
    },
  },
  rightZone: _rightZoneAllOn,
  sticky: true,
  glassMorphism: true,
  heightPx: 64,
} satisfies NavbarConfig;

const _navbarTabs: NavbarConfig = {
  leftZone: { logo: { alt: 'HRCore', brandName: 'HRCore', homeRoute: '/' } },
  centerZone: {
    menu: {
      variant: 'tabs',
      activeMatchStrategy: 'prefix',
      items: [_flatLink, _withPermission],
    },
  },
  rightZone: { userMenu: _rightZoneAllOn.userMenu },
} satisfies NavbarConfig;

const _navbarIconOnly: NavbarConfig = {
  leftZone: { logo: { alt: 'icon-app', homeRoute: '/' } },
  centerZone: {
    menu: {
      variant: 'icon',
      activeMatchStrategy: 'exact',
      items: [_flatLink],
    },
  },
  rightZone: { userMenu: _rightZoneAllOn.userMenu },
} satisfies NavbarConfig;

// ───────────────────────────────────────────────────────────────────────────────
// 5. FooterConfig — every variant + every compliance badge
// ───────────────────────────────────────────────────────────────────────────────

const _allBadges: readonly ComplianceBadge[] = [
  'soc2',
  'hipaa',
  'iso27001',
  'gdpr',
  'pci',
  'eeoc',
  'finra',
];

const _footerFull: FooterConfig = {
  variant: 'full',
  logo: { alt: 'ManyMoney', brandName: 'ManyMoney' },
  tagline: 'Trader workspace built on signals.',
  columns: [
    {
      heading: 'Product',
      links: [
        { label: 'Dashboard', routePath: '/dashboard' },
        { label: 'Signals', routePath: '/signals', badge: { value: 'New', variant: 'success' } },
      ],
    },
    {
      heading: 'Support',
      links: [
        { label: 'Help center', externalUrl: 'https://help.example.com' },
        { label: 'Contact', externalUrl: 'mailto:support@example.com' },
      ],
    },
  ],
  social: [
    { platform: 'twitter', url: 'https://twitter.com/example' },
    { platform: 'linkedin', url: 'https://linkedin.com/company/example' },
    { platform: 'github', url: 'https://github.com/example' },
  ],
  newsletter: {
    enabled: true,
    heading: 'Get the weekly trading digest',
    placeholder: 'you@firm.com',
    submitLabel: 'Subscribe',
    actionKey: 'newsletter.subscribe',
  },
  compliance: {
    badges: _allBadges,
    disclaimer:
      'Securities offered through ManyMoney Securities LLC, member FINRA / SIPC. Investing involves risk.',
    cookieConsent: true,
  },
  bottomBar: {
    copyrightOwner: 'ManyMoney Inc.',
    copyrightYear: 2026,
    appVersion: '2.4.1',
    buildId: '9f7a3b2c',
    statusPageUrl: 'https://status.example.com',
    links: [
      { label: 'Privacy', externalUrl: 'https://example.com/privacy' },
      { label: 'Terms', externalUrl: 'https://example.com/terms' },
    ],
    languageSwitcher: {
      enabled: true,
      languages: [{ code: 'en', label: 'English' }],
    },
  },
} satisfies FooterConfig;

const _footerMinimal: FooterConfig = {
  variant: 'minimal',
  compliance: { badges: ['hipaa', 'soc2'] },
  bottomBar: { copyrightOwner: 'HealthCo' },
} satisfies FooterConfig;

const _footerApp: FooterConfig = {
  variant: 'app',
  bottomBar: { copyrightOwner: 'Embedded App', appVersion: '0.1.0' },
} satisfies FooterConfig;

// ───────────────────────────────────────────────────────────────────────────────
// 6. Output events
// ───────────────────────────────────────────────────────────────────────────────

const _actionEvent: NavActionEvent = {
  source: 'quickAction',
  actionKey: 'trade.create',
  payload: { instrumentId: 'AAPL' },
} satisfies NavActionEvent;

const _tenantEvent: NavTenantSwitchEvent = {
  fromTenantId: 't-1',
  toTenantId: 't-2',
} satisfies NavTenantSwitchEvent;

const _searchEvent: NavSearchEvent = { query: 'orders 2026' } satisfies NavSearchEvent;

// ───────────────────────────────────────────────────────────────────────────────
// 7. UserProfile + NavNotification
// ───────────────────────────────────────────────────────────────────────────────

const _profile: UserProfile = {
  id: 'u-1',
  displayName: 'Hari C',
  email: 'hari@example.com',
  role: 'Cardiology · Attending',
  orgName: 'Acme Health',
} satisfies UserProfile;

const _notification: NavNotification = {
  id: 'n-1',
  level: 'critical',
  title: 'Order failed',
  message: 'NYSE refused order #4421 — insufficient margin.',
  createdAt: '2026-04-26T10:00:00Z',
  read: false,
  deepLink: ['/orders', '4421'] as const,
  actor: 'system',
} satisfies NavNotification;

// ───────────────────────────────────────────────────────────────────────────────
// 8. ChromeConfig composite — Finance / Healthcare / HR placeholders
// ───────────────────────────────────────────────────────────────────────────────

const _domainPair: ChromeConfig = {
  navbar: _navbarFlat,
  footer: _footerFull,
} satisfies ChromeConfig;

// ───────────────────────────────────────────────────────────────────────────────
// vitest discovery hook
// ───────────────────────────────────────────────────────────────────────────────

describe('nav.models — type contract', () => {
  it('compiles every literal config above (the spec is satisfied iff this file builds)', () => {
    // Reference each binding so eslint/ts can't tree-shake them out of the build —
    // their TYPE-CHECKING is the test; their RUNTIME existence is incidental.
    const _all = [
      _flatLink,
      _flatLinkArraySegments,
      _externalLink,
      _withBadge,
      _withPermission,
      _megaMenuItem,
      _userMenuLink,
      _userMenuDivider,
      _userMenuActionLogout,
      _userMenuActionShortcuts,
      _rightZoneAllOn,
      _navbarFlat,
      _navbarTabs,
      _navbarIconOnly,
      _footerFull,
      _footerMinimal,
      _footerApp,
      _actionEvent,
      _tenantEvent,
      _searchEvent,
      _profile,
      _notification,
      _domainPair,
    ];
    expect(_all.length).toBeGreaterThan(0);
  });
});
