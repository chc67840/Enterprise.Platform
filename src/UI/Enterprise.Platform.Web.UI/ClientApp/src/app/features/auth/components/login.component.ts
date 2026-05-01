/**
 * ─── LOGIN COMPONENT ────────────────────────────────────────────────────────────
 *
 * Config-driven sign-in page. Stamps each populated `LoginPageConfig` block
 * in document order; domains (or future tenant-rebrand) opt into surfaces
 * by populating the corresponding field on the config literal.
 *
 * AUTH FLOW IS UNCHANGED
 *   - `returnUrl` query-param resolution
 *   - `AuthService.login(returnUrl, prompt)` top-level navigation
 *   - reactive redirect-when-authenticated effect (prevents re-login loops)
 *
 * CONFIG SOURCE (today)
 *   `LOGIN_PAGE_FALLBACK` — a static constant alongside this component.
 *   When the BFF endpoint `GET /api/auth/login-config` lands, swap the
 *   `config = computed(...)` with a service-fed signal — no template
 *   changes required.
 */
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '@core/auth/auth.service';
import type {
  ComplianceBadge,
  FooterLink,
  LoginPageConfig,
  LoginProviderConfig,
  LoginProviderKey,
  LoginStatusBannerSeverity,
} from '@shared/layout';

import { LOGIN_PAGE_FALLBACK } from '../login-page.config';

interface ComplianceMeta {
  readonly icon: string;
  readonly fullName: string;
}

const COMPLIANCE_META: Record<ComplianceBadge, ComplianceMeta> = {
  soc2:     { icon: 'pi pi-shield',      fullName: 'SOC 2 Type II — security, availability, confidentiality controls' },
  hipaa:    { icon: 'pi pi-heart',       fullName: 'HIPAA — health-information privacy & security (45 CFR §164)' },
  iso27001: { icon: 'pi pi-verified',    fullName: 'ISO/IEC 27001 — information security management system' },
  gdpr:     { icon: 'pi pi-lock',        fullName: 'GDPR — EU General Data Protection Regulation' },
  pci:      { icon: 'pi pi-credit-card', fullName: 'PCI DSS — Payment Card Industry Data Security Standard' },
  eeoc:     { icon: 'pi pi-users',       fullName: 'EEOC — US Equal Employment Opportunity Commission compliance' },
  finra:    { icon: 'pi pi-chart-line',  fullName: 'FINRA — US Financial Industry Regulatory Authority' },
};

const PROVIDER_DEFAULT_ICON: Record<LoginProviderKey, string> = {
  'microsoft':     'pi pi-microsoft',
  'google':        'pi pi-google',
  'apple':         'pi pi-apple',
  'github':        'pi pi-github',
  'okta':          'pi pi-key',
  'auth0':         'pi pi-key',
  'saml':          'pi pi-id-card',
  'oidc-generic':  'pi pi-sign-in',
  'local':         'pi pi-user',
};

const STATUS_ICON: Record<LoginStatusBannerSeverity, string> = {
  info:    'pi pi-info-circle',
  success: 'pi pi-check-circle',
  warning: 'pi pi-exclamation-triangle',
  danger:  'pi pi-times-circle',
};

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, TooltipModule],
  template: `
    <!-- ── STATUS BANNER (above the card) ── -->
    @if (statusBanner(); as banner) {
      <div
        class="ep-login__banner"
        [attr.data-severity]="banner.severity"
        role="status"
        [attr.aria-live]="banner.severity === 'danger' ? 'assertive' : 'polite'"
      >
        <i [class]="statusIcon(banner.severity)" aria-hidden="true"></i>
        <div class="ep-login__banner-body">
          @if (banner.title) { <strong>{{ banner.title }}</strong> }
          <span>{{ banner.message }}</span>
        </div>
      </div>
    }

    <article class="ep-login-card" aria-labelledby="ep-login-heading">
      <!-- ── BRAND BLOCK ── -->
      <header class="ep-login-card__brand">
        @if (brand().logoSrc) {
          <img
            [src]="brand().logoSrc!"
            [alt]="brand().logoAlt"
            [style.maxHeight.px]="brand().logoMaxHeightPx ?? 64"
            class="ep-login-card__logo"
          />
        }
        <h1 id="ep-login-heading" class="ep-login-card__title">{{ brand().productName }}</h1>
        @if (brand().tagline) {
          <p class="ep-login-card__tagline">{{ brand().tagline }}</p>
        }
      </header>

      <!-- ── PROVIDERS ── -->
      <div class="ep-login-card__providers" role="group" aria-label="Sign-in providers">
        @for (provider of providers(); track provider.providerKey) {
          <button
            type="button"
            class="ep-login-card__provider"
            [attr.data-provider]="provider.providerKey"
            [disabled]="provider.disabled || auth.isLoading()"
            [pTooltip]="provider.disabled ? provider.disabledReason : undefined"
            tooltipPosition="top"
            (click)="signIn(provider)"
          >
            <i [class]="provider.iconClass ?? defaultProviderIcon(provider.providerKey)" aria-hidden="true"></i>
            <span class="ep-login-card__provider-label">
              @if (auth.isLoading() && activeProvider() === provider.providerKey) {
                Signing in…
              } @else {
                {{ provider.label }}
              }
            </span>
            @if (provider.badge; as badge) {
              <span class="ep-login-card__provider-badge" [attr.data-variant]="badge.variant">
                {{ badge.value }}
              </span>
            }
          </button>
        }
      </div>

      <!-- ── HELP LINKS ── -->
      @if (helpLinks().length) {
        <ul class="ep-login-card__help" role="list">
          @for (link of helpLinks(); track link.label) {
            <li>
              <ng-container *ngTemplateOutlet="loginLink; context: { $implicit: link }" />
            </li>
          }
        </ul>
      }

      <!-- ── COMPLIANCE BADGES ── -->
      @if (complianceBadges().length) {
        <ul class="ep-login-card__badges" role="list" aria-label="Compliance certifications">
          @for (badge of complianceBadges(); track badge) {
            <li>
              <span
                class="ep-login-card__badge"
                [pTooltip]="badgeMeta(badge).fullName"
                tooltipPosition="top"
              >
                <i [class]="badgeMeta(badge).icon" aria-hidden="true"></i>
                <span class="uppercase">{{ badge }}</span>
              </span>
            </li>
          }
        </ul>
      }
    </article>

    <!-- ── COMPANY CONTACT (below card) ── -->
    @if (company(); as company) {
      <section class="ep-login__company" aria-label="Contact information">
        @if (company.supportLabel) {
          <h2 class="ep-login__company-heading">{{ company.supportLabel }}</h2>
        }
        @if (company.displayName) {
          <p class="ep-login__company-name">{{ company.displayName }}</p>
        }
        @if (company.addressLines?.length && company.addressLines; as lines) {
          <address class="ep-login__company-address">
            @for (line of lines; track line) {
              <span>{{ line }}</span>
            }
          </address>
        }
        <div class="ep-login__company-contact">
          @if (company.supportEmail) {
            <a [href]="'mailto:' + company.supportEmail" class="ep-login__link">
              <i class="pi pi-envelope" aria-hidden="true"></i>
              {{ company.supportEmail }}
            </a>
          }
          @if (company.supportPhone) {
            <a [href]="'tel:' + company.supportPhone" class="ep-login__link">
              <i class="pi pi-phone" aria-hidden="true"></i>
              {{ company.supportPhone }}
            </a>
          }
        </div>
      </section>
    }

    <!-- ── LEGAL FOOTER ── -->
    @if (legalFooter(); as legal) {
      <footer class="ep-login__legal">
        @if (copyrightText(); as copyright) {
          <p class="ep-login__legal-copy">{{ copyright }}</p>
        }
        @if (legal.links?.length && legal.links; as links) {
          <ul class="ep-login__legal-links" role="list">
            @for (link of links; track link.label) {
              <li>
                <ng-container *ngTemplateOutlet="loginLink; context: { $implicit: link }" />
              </li>
            }
          </ul>
        }
      </footer>
    }

    <!-- Reusable link template (router / external / plain href) -->
    <ng-template #loginLink let-link>
      @if (link.routePath) {
        <a [routerLink]="link.routePath" class="ep-login__link">{{ link.label }}</a>
      } @else if (link.externalUrl) {
        <a
          [href]="link.externalUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="ep-login__link"
          [attr.aria-label]="link.label + ' (opens in a new tab)'"
        >
          {{ link.label }}
          <i class="pi pi-external-link text-[10px] opacity-60" aria-hidden="true"></i>
        </a>
      }
    </ng-template>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.25rem;
      width: 100%;
    }

    /* ── status banner (above the card) ─────────────────────────────────── */
    .ep-login__banner {
      width: 100%;
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.75rem 1rem;
      border-radius: var(--ep-radius-md);
      background-color: var(--ep-color-neutral-50);
      border: 1px solid var(--ep-border-subtle);
      box-shadow: var(--ep-shadow-sm);
    }
    .ep-login__banner[data-severity='info']    { border-left: 4px solid var(--ep-color-info); }
    .ep-login__banner[data-severity='success'] { border-left: 4px solid var(--ep-color-success); }
    .ep-login__banner[data-severity='warning'] { border-left: 4px solid var(--ep-color-warning); }
    .ep-login__banner[data-severity='danger']  { border-left: 4px solid var(--ep-color-danger); }
    .ep-login__banner i { font-size: 1rem; color: var(--ep-color-primary-700); }
    .ep-login__banner-body { display: flex; flex-direction: column; gap: 0.125rem; font-size: 0.875rem; color: var(--ep-text-primary); }

    /* ── login card (frosted brand-card surface) ────────────────────────── */
    .ep-login-card {
      width: 100%;
      background-color: var(--ep-surface-0);
      border: 1px solid var(--ep-border-subtle);
      border-radius: var(--ep-nav-radius-top);
      box-shadow: var(--ep-shadow-lg);
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .ep-login-card__brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      text-align: center;
    }
    .ep-login-card__logo {
      width: auto;
      height: auto;
      object-fit: contain;
    }
    .ep-login-card__title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--ep-text-primary);
      letter-spacing: -0.01em;
    }
    .ep-login-card__tagline {
      margin: 0;
      font-size: 0.9375rem;
      color: var(--ep-text-muted);
    }

    /* ── providers ──────────────────────────────────────────────────────── */
    .ep-login-card__providers {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }
    .ep-login-card__provider {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.625rem;
      width: 100%;
      padding: 0.75rem 1rem;
      border-radius: var(--ep-radius-md);
      border: 1px solid var(--ep-color-primary-700);
      background-color: var(--ep-color-primary-700);
      color: #ffffff;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      transition:
        background-color calc(var(--ep-duration-fast, 120ms) * var(--ep-motion-scale, 1)) var(--ep-ease-standard, ease),
        transform calc(var(--ep-duration-fast, 120ms) * var(--ep-motion-scale, 1)) var(--ep-ease-standard, ease);
    }
    .ep-login-card__provider:hover:not([disabled]) {
      background-color: var(--ep-color-primary-800);
      transform: translateY(-1px);
    }
    .ep-login-card__provider:focus-visible {
      outline: 2px solid var(--ep-color-jessamine-500);
      outline-offset: 2px;
    }
    .ep-login-card__provider[disabled] {
      opacity: 0.55;
      cursor: not-allowed;
    }
    /* Provider-specific accents — only deviate where the brand demands it. */
    .ep-login-card__provider[data-provider='google'],
    .ep-login-card__provider[data-provider='apple'],
    .ep-login-card__provider[data-provider='github'] {
      background-color: var(--ep-surface-0);
      color: var(--ep-text-primary);
      border-color: var(--ep-border-subtle);
    }
    .ep-login-card__provider[data-provider='google']:hover:not([disabled]),
    .ep-login-card__provider[data-provider='apple']:hover:not([disabled]),
    .ep-login-card__provider[data-provider='github']:hover:not([disabled]) {
      background-color: var(--ep-color-neutral-100);
    }
    .ep-login-card__provider i { font-size: 1rem; pointer-events: none; }
    .ep-login-card__provider-label { pointer-events: none; }
    .ep-login-card__provider-badge {
      margin-left: auto;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      background-color: var(--ep-color-jessamine-500);
      color: var(--ep-color-primary-900);
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    /* ── help links ─────────────────────────────────────────────────────── */
    .ep-login-card__help {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.25rem 1.25rem;
      font-size: 0.8125rem;
    }

    /* ── compliance badges ──────────────────────────────────────────────── */
    .ep-login-card__badges {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem;
      border-top: 1px solid var(--ep-border-subtle);
      padding-top: 1.25rem;
    }
    .ep-login-card__badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      background-color: var(--ep-color-neutral-100);
      border: 1px solid var(--ep-border-subtle);
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--ep-text-primary);
    }
    .ep-login-card__badge i { color: var(--ep-color-primary-700); }

    /* ── company contact (below card) ───────────────────────────────────── */
    .ep-login__company {
      width: 100%;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.8125rem;
      color: var(--ep-text-muted);
    }
    .ep-login__company-heading {
      margin: 0;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--ep-text-secondary);
    }
    .ep-login__company-name {
      margin: 0;
      font-weight: 600;
      color: var(--ep-text-primary);
    }
    .ep-login__company-address {
      font-style: normal;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }
    .ep-login__company-contact {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.25rem 1rem;
      margin-top: 0.25rem;
    }

    /* ── legal footer ───────────────────────────────────────────────────── */
    .ep-login__legal {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--ep-text-muted);
    }
    .ep-login__legal-copy { margin: 0; }
    .ep-login__legal-links {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.25rem 1rem;
    }

    /* ── shared link styling (help / company / legal) ───────────────────── */
    .ep-login__link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--ep-color-primary-700);
      text-decoration: none;
    }
    .ep-login__link:hover {
      color: var(--ep-color-primary-800);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .ep-login__link:focus-visible {
      outline: 2px solid var(--ep-color-jessamine-500);
      outline-offset: 2px;
      border-radius: 2px;
    }
  `],
})
export class LoginComponent {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Captured at mount; used for the AuthService.login() returnUrl arg. */
  private readonly returnUrl: string = this.route.snapshot.queryParams['returnUrl'] ?? '/dashboard';

  /** Tracks which provider the user just clicked — drives the per-button "Signing in…" label. */
  protected readonly activeProvider = signal<LoginProviderKey | null>(null);

  /**
   * Static fallback for now. When `GET /api/auth/login-config` lands the
   * config moves to a service-fed signal — template doesn't change.
   */
  protected readonly config = computed<LoginPageConfig>(() => LOGIN_PAGE_FALLBACK);

  // Per-block projections — keep templates terse + give us a single point
  // to swap to a fetched config later.
  protected readonly brand          = computed(() => this.config().brand);
  protected readonly providers      = computed(() => this.config().providers);
  protected readonly statusBanner   = computed(() => this.config().statusBanner ?? null);
  protected readonly helpLinks      = computed<readonly FooterLink[]>(() => this.config().helpLinks ?? []);
  protected readonly complianceBadges = computed<readonly ComplianceBadge[]>(
    () => this.config().compliance?.badges ?? [],
  );
  protected readonly company        = computed(() => this.config().company ?? null);
  protected readonly legalFooter    = computed(() => this.config().legalFooter ?? null);

  /**
   * Rendered copyright string. Falls back gracefully when the legal-footer
   * block omits owner/year — same tolerance pattern as the chrome footer.
   */
  protected readonly copyrightText = computed<string | null>(() => {
    const c = this.legalFooter()?.copyright;
    if (!c) return null;
    if (c.text) return c.text;
    const year = c.year ?? new Date().getFullYear();
    return c.owner ? `© ${year} ${c.owner}. All rights reserved.` : `© ${year}`;
  });

  constructor() {
    // Reactive redirect: bounce signed-in users away from /auth/login. Same
    // pattern as before — preserves the "no re-login loops" invariant.
    effect(() => {
      if (this.auth.isAuthenticated()) {
        void this.router.navigateByUrl(this.returnUrl);
      }
    });
  }

  protected signIn(provider: LoginProviderConfig): void {
    if (provider.disabled) return;
    this.activeProvider.set(provider.providerKey);
    const returnUrl = provider.returnUrl ?? this.returnUrl;
    // Only the OIDC `login` / `select_account` values are forwarded to
    // AuthService.login — `consent` and `none` aren't part of that contract.
    const prompt: 'login' | 'select_account' | undefined =
      provider.entraPrompt === 'login' || provider.entraPrompt === 'select_account'
        ? provider.entraPrompt
        : undefined;
    this.auth.login(returnUrl, prompt);
  }

  protected badgeMeta(badge: ComplianceBadge): ComplianceMeta {
    return COMPLIANCE_META[badge];
  }

  protected defaultProviderIcon(key: LoginProviderKey): string {
    return PROVIDER_DEFAULT_ICON[key] ?? 'pi pi-sign-in';
  }

  protected statusIcon(severity: LoginStatusBannerSeverity): string {
    return STATUS_ICON[severity];
  }
}
