/**
 * ─── domains/finance.config.ts ──────────────────────────────────────────────────
 *
 * Spec D8 — Finance (ManyMoney) domain chrome. Flat nav, NYSE clock, market-
 * status pill, command-palette search, trader quick actions, FINRA + SOC2 +
 * GDPR badges, SEC/FINRA risk disclaimer.
 */
import type { DomainChromeConfig, FooterConfig, NavbarConfig } from '../models/nav.models';

const NAVBAR: NavbarConfig = {
  leftZone: {
    logo: {
      alt: 'ManyMoney logo — home',
      brandName: 'ManyMoney',
      subLabel: 'Trader Workspace',
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
          id: 'signals',
          label: 'Signals',
          icon: 'pi pi-bolt',
          routePath: '/signals',
          badge: { value: 'Live', variant: 'danger', pulse: true },
        },
        { id: 'portfolio', label: 'Portfolio', icon: 'pi pi-briefcase', routePath: '/portfolio' },
        {
          id: 'analytics',
          label: 'Analytics',
          icon: 'pi pi-chart-bar',
          children: [
            {
              heading: 'Performance',
              subheading: 'Trade + signal P&L',
              leaves: [
                { id: 'an.pl', label: 'P&L', icon: 'pi pi-chart-line', routePath: '/analytics/pl', description: 'Realised + unrealised gains' },
                { id: 'an.win', label: 'Win Rate', icon: 'pi pi-percentage', routePath: '/analytics/win-rate' },
                { id: 'an.spy', label: 'Vs SPY', icon: 'pi pi-flag', routePath: '/analytics/benchmark' },
              ],
            },
            {
              heading: 'Risk',
              leaves: [
                { id: 'an.draw', label: 'Drawdown', icon: 'pi pi-chart-line', routePath: '/analytics/drawdown' },
                { id: 'an.var', label: 'Value at Risk', icon: 'pi pi-shield', routePath: '/analytics/var' },
                { id: 'an.exp', label: 'Sector exposure', icon: 'pi pi-th-large', routePath: '/analytics/exposure' },
              ],
            },
          ],
        },
        { id: 'journal', label: 'Journal', icon: 'pi pi-book', routePath: '/journal' },
      ],
    },
  },
  rightZone: {
    clock: { enabled: true, timezone: 'America/New_York', format: '24h', showTimezone: true },
    marketStatus: { enabled: true, markets: [{ symbol: 'NYSE', label: 'NYSE' }] },
    globalSearch: { enabled: true, placeholder: 'Search trades, signals…', commandPaletteMode: true },
    aiAssistant: { enabled: true, label: 'Ask AI', icon: 'pi pi-sparkles', actionKey: 'ai.open' },
    quickActions: {
      enabled: true,
      label: 'Quick actions',
      icon: 'pi pi-plus',
      actions: [
        { id: 'qa.trade', label: 'Log trade', icon: 'pi pi-plus-circle', actionKey: 'trade.create', shortcut: 'Ctrl+T' },
        { id: 'qa.signal', label: 'Add signal', icon: 'pi pi-bolt', actionKey: 'signal.create', shortcut: 'Ctrl+S' },
        { id: 'qa.alert', label: 'Set alert', icon: 'pi pi-bell', actionKey: 'alert.create', shortcut: 'Ctrl+A' },
      ],
    },
    notifications: { enabled: true, maxBadgeCount: 99, viewAllRoute: '/notifications' },
    help: { enabled: true, label: 'Help', docsUrl: 'https://docs.manymoney.example.com' },
    themeToggle: { enabled: true, includeSystem: true },
    userMenu: {
      enabled: true,
      showNameInHeader: true,
      showRoleInHeader: false,
      menuItems: [
        { kind: 'link', id: 'profile', label: 'Profile', icon: 'pi pi-user', routePath: '/profile' },
        { kind: 'link', id: 'org', label: 'Organization', icon: 'pi pi-building', routePath: '/organization' },
        { kind: 'link', id: 'billing', label: 'Billing', icon: 'pi pi-credit-card', routePath: '/billing' },
        { kind: 'divider', id: 'div-1' },
        { kind: 'action', id: 'shortcuts', label: 'Keyboard shortcuts', icon: 'pi pi-keyboard', actionKey: 'help.shortcuts' },
        { kind: 'action', id: 'whats-new', label: "What's new", icon: 'pi pi-star', actionKey: 'help.whatsNew' },
        { kind: 'divider', id: 'div-2' },
        { kind: 'action', id: 'sign-out', label: 'Sign out', icon: 'pi pi-sign-out', actionKey: 'auth.logout', isLogout: true },
      ],
    },
  },
  sticky: true,
  glassMorphism: true,
  heightPx: 64,
};

const FOOTER: FooterConfig = {
  variant: 'full',
  logo: { alt: 'ManyMoney', brandName: 'ManyMoney' },
  tagline: 'Trader Workspace',
  columns: [
    {
      heading: 'Product',
      links: [
        { label: 'Signals', routePath: '/signals' },
        { label: 'Portfolio', routePath: '/portfolio' },
        { label: 'Analytics', routePath: '/analytics' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'About', externalUrl: 'https://manymoney.example.com/about' },
        { label: 'Careers', externalUrl: 'https://manymoney.example.com/careers' },
        { label: 'Press', externalUrl: 'https://manymoney.example.com/press' },
      ],
    },
    {
      heading: 'Support',
      links: [
        { label: 'Help center', externalUrl: 'https://help.manymoney.example.com' },
        { label: 'Contact', externalUrl: 'mailto:support@manymoney.example.com' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { label: 'Form CRS', externalUrl: 'https://manymoney.example.com/crs' },
        { label: 'Disclosures', externalUrl: 'https://manymoney.example.com/disclosures' },
      ],
    },
  ],
  social: [
    { platform: 'twitter', url: 'https://twitter.com/manymoney' },
    { platform: 'linkedin', url: 'https://linkedin.com/company/manymoney' },
  ],
  newsletter: {
    enabled: true,
    heading: 'Weekly market digest',
    placeholder: 'you@firm.com',
    submitLabel: 'Subscribe',
    actionKey: 'newsletter.subscribe',
  },
  compliance: {
    badges: ['finra', 'soc2', 'gdpr'],
    disclaimer:
      'Securities offered through ManyMoney Securities LLC, member FINRA/SIPC. Investment advisory ' +
      'services offered through ManyMoney Advisors LLC, an SEC-registered investment adviser. ' +
      'Investing in securities involves risks, including the loss of principal. Past performance is ' +
      'not indicative of future results. Read our Form CRS and disclosures before investing.',
    cookieConsent: true,
  },
  bottomBar: {
    copyrightOwner: 'ManyMoney Inc.',
    appVersion: '2.4.1',
    statusPageUrl: 'https://status.manymoney.example.com',
    links: [
      { label: 'Privacy', externalUrl: 'https://manymoney.example.com/privacy' },
      { label: 'Terms', externalUrl: 'https://manymoney.example.com/terms' },
      { label: 'Accessibility', externalUrl: 'https://manymoney.example.com/accessibility' },
    ],
  },
};

export const FINANCE_CHROME: DomainChromeConfig = { navbar: NAVBAR, footer: FOOTER };

export function createFinanceChrome(): DomainChromeConfig {
  return FINANCE_CHROME;
}
