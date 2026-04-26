/**
 * ─── domains/healthcare.config.ts ───────────────────────────────────────────────
 *
 * Spec D8 — Healthcare (HealthCo EHR) domain chrome. Flat nav with permission
 * gates on Records + Billing, shift-status pill, clinical AI assistant,
 * patient quick actions, HIPAA + SOC2 + ISO27001 + GDPR compliance, HIPAA
 * 45 CFR §164.308 disclaimer, minimal-variant footer.
 */
import type { DomainChromeConfig, FooterConfig, NavbarConfig } from '../models/nav.models';

const NAVBAR: NavbarConfig = {
  leftZone: {
    logo: {
      alt: 'HealthCo EHR — home',
      brandName: 'HealthCo',
      subLabel: 'Electronic Health Records',
      homeRoute: '/dashboard',
      envBadge: 'production',
    },
  },
  centerZone: {
    menu: {
      variant: 'flat',
      activeMatchStrategy: 'prefix',
      items: [
        { id: 'patients', label: 'Patients', icon: 'pi pi-users', routePath: '/patients' },
        { id: 'sched', label: 'Scheduling', icon: 'pi pi-calendar', routePath: '/scheduling' },
        {
          id: 'records',
          label: 'Records',
          icon: 'pi pi-folder',
          routePath: '/records',
          permission: { requiredPolicy: 'records:read' },
        },
        { id: 'meds', label: 'Medications', icon: 'pi pi-tablet', routePath: '/medications' },
        { id: 'labs', label: 'Labs', icon: 'pi pi-chart-line', routePath: '/labs' },
        {
          id: 'billing',
          label: 'Billing',
          icon: 'pi pi-credit-card',
          routePath: '/billing',
          permission: { requiredPolicy: 'billing:read' },
        },
      ],
    },
  },
  rightZone: {
    clock: { enabled: true, format: '24h', showTimezone: true },
    shiftStatus: { enabled: true, label: 'On shift' },
    notifications: { enabled: true, maxBadgeCount: 99, viewAllRoute: '/notifications' },
    messages: { enabled: true, maxBadgeCount: 99, viewAllRoute: '/messages' },
    aiAssistant: {
      enabled: true,
      label: 'Clinical AI',
      icon: 'pi pi-sparkles',
      actionKey: 'ai.openClinical',
    },
    quickActions: {
      enabled: true,
      label: 'Quick actions',
      actions: [
        { id: 'qa.patient', label: 'New patient', icon: 'pi pi-user-plus', actionKey: 'patient.create' },
        { id: 'qa.appt', label: 'New appointment', icon: 'pi pi-calendar-plus', actionKey: 'appointment.create' },
        { id: 'qa.note', label: 'New note', icon: 'pi pi-pencil', actionKey: 'note.create' },
        { id: 'qa.order', label: 'New order', icon: 'pi pi-file-edit', actionKey: 'order.create' },
      ],
    },
    help: { enabled: true, label: 'Help', docsUrl: 'https://docs.healthco.example.com' },
    themeToggle: { enabled: true, includeSystem: true },
    userMenu: {
      enabled: true,
      showNameInHeader: true,
      showRoleInHeader: true,
      menuItems: [
        { kind: 'link', id: 'profile', label: 'My profile', icon: 'pi pi-user', routePath: '/profile' },
        { kind: 'link', id: 'sig', label: 'E-signature', icon: 'pi pi-pen-to-square', routePath: '/profile/signature' },
        { kind: 'divider', id: 'div-1' },
        {
          kind: 'link',
          id: 'audit-self',
          label: 'My audit log',
          icon: 'pi pi-list',
          routePath: '/audit/self',
          permission: { requiredPolicy: 'audit:self:read' },
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
  variant: 'minimal',
  columns: [
    {
      heading: 'Clinical',
      links: [
        { label: 'Patients', routePath: '/patients' },
        { label: 'Records', routePath: '/records' },
        { label: 'Orders', routePath: '/orders' },
      ],
    },
    {
      heading: 'Support',
      links: [
        { label: 'Help center', externalUrl: 'https://help.healthco.example.com' },
        { label: 'Submit ticket', externalUrl: 'mailto:support@healthco.example.com' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { label: 'HIPAA Notice', externalUrl: 'https://healthco.example.com/hipaa-notice' },
        { label: 'BAA', externalUrl: 'https://healthco.example.com/baa' },
      ],
    },
  ],
  compliance: {
    badges: ['hipaa', 'soc2', 'iso27001', 'gdpr'],
    disclaimer:
      'HealthCo complies with HIPAA Security Rule (45 CFR §164.308). Protected Health Information (PHI) ' +
      'is encrypted at rest and in transit. Access is logged per the audit-control standard. Workforce ' +
      'members must complete annual HIPAA training and acknowledge the Business Associate Agreement.',
    cookieConsent: true,
  },
  bottomBar: {
    copyrightOwner: 'HealthCo Inc.',
    appVersion: '4.8.2',
    statusPageUrl: 'https://status.healthco.example.com',
    links: [
      { label: 'Privacy', externalUrl: 'https://healthco.example.com/privacy' },
      { label: 'Terms', externalUrl: 'https://healthco.example.com/terms' },
      { label: 'Accessibility', externalUrl: 'https://healthco.example.com/accessibility' },
    ],
  },
};

export const HEALTHCARE_CHROME: DomainChromeConfig = { navbar: NAVBAR, footer: FOOTER };

export function createHealthcareChrome(): DomainChromeConfig {
  return HEALTHCARE_CHROME;
}
