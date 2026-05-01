/**
 * Static login-page config consumed by `LoginComponent` until the BFF
 * endpoint `GET /api/auth/login-config` lands. Mirrors the C# shape in
 * `Services/Chrome/StaticChromeBuilder.BuildLoginConfig()` — keep them in
 * lock-step so swapping the static factory for an HTTP call is a pure
 * provider replacement.
 *
 * Single deployment = single login config; multi-tenant rebrand later
 * supplies a different `LoginPageConfig` literal via the same shape.
 */
import type { LoginPageConfig } from '@shared/layout';

export const LOGIN_PAGE_FALLBACK: LoginPageConfig = {
  variant: 'centered',
  brand: {
    logoSrc: '/rounded_logo_svg.svg',
    logoAlt: 'Enterprise Platform',
    productName: 'Enterprise Platform',
    tagline: 'Sign in to continue',
    logoMaxHeightPx: 64,
  },
  providers: [
    {
      providerKey: 'microsoft',
      label: 'Sign in with Microsoft',
      iconClass: 'pi pi-microsoft',
      entraPrompt: 'select_account',
    },
  ],
  compliance: {
    badges: ['soc2', 'gdpr'],
    cookieConsent: false,
  },
  company: {
    displayName: 'Enterprise Platform Inc.',
    addressLines: [
      'Enterprise Platform HQ',
      '400 Otarre Parkway',
      'Cayce, SC 29033',
    ],
    supportEmail: 'support@example.com',
    supportLabel: 'Need help?',
  },
  helpLinks: [
    { label: 'Trouble signing in?', externalUrl: 'https://example.com/sign-in-help' },
    { label: 'System status',       externalUrl: 'https://status.example.com' },
  ],
  legalFooter: {
    copyright: { owner: 'Enterprise Platform Inc.' },
    links: [
      { label: 'Privacy', externalUrl: 'https://example.com/privacy' },
      { label: 'Terms',   externalUrl: 'https://example.com/terms' },
      { label: 'Cookies', externalUrl: 'https://example.com/cookies' },
    ],
  },
  background: {
    kind: 'gradient',
    tokenAlias: 'var(--ep-gradient-brand-subtle)',
  },
};
