/**
 * ─── domains/hr.config.ts ───────────────────────────────────────────────────────
 *
 * Spec D8 — HR (HRCore) domain chrome. Tabs nav with payroll permission gate,
 * shift status, language switcher (en / es / fr), HR quick actions, EEOC
 * disclaimer, full-variant footer.
 */
import type { DomainChromeConfig, FooterConfig, NavbarConfig } from '../models/nav.models';

const NAVBAR: NavbarConfig = {
  leftZone: {
    logo: {
      alt: 'HRCore — home',
      brandName: 'HRCore',
      subLabel: 'Employee Workspace',
      homeRoute: '/dashboard',
      envBadge: 'production',
    },
  },
  centerZone: {
    menu: {
      variant: 'tabs',
      activeMatchStrategy: 'prefix-with-redirect',
      items: [
        { id: 'people', label: 'People', icon: 'pi pi-users', routePath: '/people' },
        { id: 'recruit', label: 'Recruitment', icon: 'pi pi-search', routePath: '/recruitment' },
        {
          id: 'payroll',
          label: 'Payroll',
          icon: 'pi pi-credit-card',
          routePath: '/payroll',
          permission: { requiredPolicy: 'payroll:read' },
        },
        { id: 'time', label: 'Time & Leave', icon: 'pi pi-calendar', routePath: '/time' },
        { id: 'perf', label: 'Performance', icon: 'pi pi-chart-line', routePath: '/performance' },
        { id: 'reports', label: 'Reports', icon: 'pi pi-chart-bar', routePath: '/reports' },
      ],
    },
  },
  rightZone: {
    shiftStatus: { enabled: true, label: 'Working' },
    globalSearch: { enabled: true, placeholder: 'Search employees, jobs, leaves…' },
    quickActions: {
      enabled: true,
      label: 'Quick actions',
      actions: [
        { id: 'qa.emp', label: 'Add employee', icon: 'pi pi-user-plus', actionKey: 'employee.create' },
        { id: 'qa.job', label: 'Post job', icon: 'pi pi-megaphone', actionKey: 'job.create' },
        { id: 'qa.leave', label: 'Approve leave', icon: 'pi pi-check-circle', actionKey: 'leave.approve' },
        { id: 'qa.review', label: 'Start review', icon: 'pi pi-pencil', actionKey: 'review.start' },
      ],
    },
    notifications: { enabled: true, maxBadgeCount: 99, viewAllRoute: '/notifications' },
    messages: { enabled: true, maxBadgeCount: 99, viewAllRoute: '/messages' },
    aiAssistant: {
      enabled: true,
      label: 'HR Assistant',
      icon: 'pi pi-sparkles',
      actionKey: 'ai.openHr',
    },
    themeToggle: { enabled: true, includeSystem: true },
    languageSwitcher: {
      enabled: true,
      languages: [
        { code: 'en', label: 'English', flagEmoji: '🇺🇸' },
        { code: 'es', label: 'Español', flagEmoji: '🇪🇸' },
        { code: 'fr', label: 'Français', flagEmoji: '🇫🇷' },
      ],
    },
    userMenu: {
      enabled: true,
      showNameInHeader: true,
      showRoleInHeader: true,
      menuItems: [
        { kind: 'link', id: 'profile', label: 'My HR profile', icon: 'pi pi-user', routePath: '/profile' },
        { kind: 'link', id: 'leave', label: 'My leave balance', icon: 'pi pi-calendar', routePath: '/profile/leave' },
        {
          kind: 'link',
          id: 'pay',
          label: 'My payslips',
          icon: 'pi pi-file',
          routePath: '/profile/payslips',
          permission: { requiredPolicy: 'payroll:self' },
        },
        { kind: 'divider', id: 'div-1' },
        {
          kind: 'link',
          id: 'org',
          label: 'Org settings',
          icon: 'pi pi-cog',
          routePath: '/admin/org',
          permission: { roles: ['admin'] },
        },
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
  logo: { alt: 'HRCore', brandName: 'HRCore' },
  tagline: 'Employee Workspace',
  columns: [
    {
      heading: 'HR Features',
      links: [
        { label: 'People', routePath: '/people' },
        { label: 'Time & Leave', routePath: '/time' },
        { label: 'Performance', routePath: '/performance' },
        { label: 'Reports', routePath: '/reports' },
      ],
    },
    {
      heading: 'Support',
      links: [
        { label: 'Help center', externalUrl: 'https://help.hrcore.example.com' },
        { label: 'Contact support', externalUrl: 'mailto:support@hrcore.example.com' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { label: 'EEO Policy', externalUrl: 'https://hrcore.example.com/eeo-policy' },
        { label: 'DPA', externalUrl: 'https://hrcore.example.com/dpa' },
      ],
    },
  ],
  social: [
    { platform: 'linkedin', url: 'https://linkedin.com/company/hrcore' },
    { platform: 'twitter', url: 'https://twitter.com/hrcore' },
  ],
  newsletter: {
    enabled: true,
    heading: 'HR ops digest',
    placeholder: 'name@company.com',
    submitLabel: 'Subscribe',
    actionKey: 'newsletter.subscribe',
  },
  compliance: {
    badges: ['soc2', 'gdpr', 'eeoc'],
    disclaimer:
      'HRCore is an Equal Opportunity Employer subscriber. Hiring, promotion, compensation, training, ' +
      'and discipline decisions managed in HRCore must comply with EEOC, ADA, ADEA, and Title VII of ' +
      'the Civil Rights Act. Customers are responsible for the lawful operation of the platform within ' +
      'their jurisdiction; see our Acceptable Use Policy.',
    cookieConsent: true,
  },
  bottomBar: {
    copyrightOwner: 'HRCore Inc.',
    appVersion: '3.7.0',
    statusPageUrl: 'https://status.hrcore.example.com',
    links: [
      { label: 'Privacy', externalUrl: 'https://hrcore.example.com/privacy' },
      { label: 'Terms', externalUrl: 'https://hrcore.example.com/terms' },
      { label: 'Accessibility', externalUrl: 'https://hrcore.example.com/accessibility' },
    ],
    languageSwitcher: {
      enabled: true,
      languages: [
        { code: 'en', label: 'English' },
        { code: 'es', label: 'Español' },
        { code: 'fr', label: 'Français' },
      ],
    },
  },
};

export const HR_CHROME: DomainChromeConfig = { navbar: NAVBAR, footer: FOOTER };

export function createHrChrome(): DomainChromeConfig {
  return HR_CHROME;
}
