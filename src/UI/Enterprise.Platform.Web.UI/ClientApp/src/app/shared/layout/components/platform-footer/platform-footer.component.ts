/**
 * ─── shared/layout/components/platform-footer ───────────────────────────────────
 *
 * F.5 — config-driven footer per spec D7 + types D6 (`FooterConfig`).
 *
 * Variants (single template, @switch):
 *   - 'full'    → top brand + columns + newsletter, then compliance, then bottom bar
 *   - 'minimal' → compliance + bottom bar only
 *   - 'app'     → bottom bar only
 *
 * Compliance: 7 badge values (`soc2|hipaa|iso27001|gdpr|pci|eeoc|finra`)
 * mapped to PrimeIcons + tooltip + colour pill. Disclaimer body capped at 800 px.
 *
 * Cookie consent: dismissible bottom-of-viewport bar, localStorage-backed
 * (`ep:cookie-consent:accepted`); only renders when
 * `compliance.cookieConsent === true` AND not yet dismissed.
 *
 * Newsletter: simple email input + submit; emits `(navAction)` with
 * `source: 'newsletter'` + the configured `actionKey`. Host owns the actual
 * subscribe HTTP call.
 *
 * Outputs:
 *   - (navAction) for newsletter submit
 * Otherwise the footer is link-and-display only.
 */
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';

import type {
  ComplianceBadge,
  FooterConfig,
  FooterLink,
  NavActionEvent,
  SocialPlatform,
} from '@shared/layout';

const COOKIE_CONSENT_KEY = 'ep:cookie-consent:accepted';

interface ComplianceMeta {
  readonly icon: string;
  readonly fullName: string;
}

const COMPLIANCE_META: Record<ComplianceBadge, ComplianceMeta> = {
  soc2: { icon: 'pi pi-shield', fullName: 'SOC 2 Type II — security, availability, confidentiality controls' },
  hipaa: { icon: 'pi pi-heart', fullName: 'HIPAA — health-information privacy & security (45 CFR §164)' },
  iso27001: { icon: 'pi pi-verified', fullName: 'ISO/IEC 27001 — information security management system' },
  gdpr: { icon: 'pi pi-lock', fullName: 'GDPR — EU General Data Protection Regulation' },
  pci: { icon: 'pi pi-credit-card', fullName: 'PCI DSS — Payment Card Industry Data Security Standard' },
  eeoc: { icon: 'pi pi-users', fullName: 'EEOC — US Equal Employment Opportunity Commission compliance' },
  finra: { icon: 'pi pi-chart-line', fullName: 'FINRA — US Financial Industry Regulatory Authority' },
};

const SOCIAL_ICONS: Record<SocialPlatform, string> = {
  twitter: 'pi pi-twitter',
  linkedin: 'pi pi-linkedin',
  github: 'pi pi-github',
  youtube: 'pi pi-youtube',
  facebook: 'pi pi-facebook',
  instagram: 'pi pi-instagram',
  mastodon: 'pi pi-globe',
  discord: 'pi pi-discord',
};

@Component({
  selector: 'app-platform-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ReactiveFormsModule, RouterLink, TooltipModule],
  template: `
    <footer
      class="ep-footer"
      [class.ep-footer--full]="config().variant === 'full'"
      [class.ep-footer--minimal]="config().variant === 'minimal'"
      [class.ep-footer--app]="config().variant === 'app'"
      role="contentinfo"
    >
      <!-- 4 px brand-cool gradient accent strip -->
      <div class="ep-footer__accent" aria-hidden="true"></div>

      <!-- ───── TOP SECTION (full only) ───── -->
      @if (config().variant === 'full') {
        <div class="ep-footer__top">
          <div class="ep-footer__container">
            <div class="ep-footer__top-row">
              <!-- Brand block -->
              <div class="ep-footer__brand">
                @if (config().logo?.imageSrc) {
                  <img
                    [src]="config().logo!.imageSrc!"
                    [alt]="config().logo!.alt"
                    width="40"
                    height="40"
                    loading="lazy"
                    class="ep-footer__brand-logo"
                  />
                } @else {
                  <span class="ep-footer__brand-glyph" aria-hidden="true"><i class="pi pi-bolt"></i></span>
                }
                <div>
                  <div class="ep-footer__brand-name">
                    {{ config().logo?.brandName ?? config().logo?.alt }}
                  </div>
                  @if (config().tagline) {
                    <div class="ep-footer__brand-tag">{{ config().tagline }}</div>
                  }
                </div>
              </div>

              <!-- Link columns -->
              @if (config().columns?.length) {
                <div class="ep-footer__columns">
                  @for (column of config().columns!; track column.heading) {
                    <div class="ep-footer__column">
                      <h3 class="ep-footer__column-heading">{{ column.heading }}</h3>
                      <ul class="ep-footer__column-links" role="list">
                        @for (link of column.links; track link.label) {
                          <li>
                            <ng-container *ngTemplateOutlet="footerLink; context: { $implicit: link }" />
                          </li>
                        }
                      </ul>
                    </div>
                  }
                </div>
              }

              <!-- Newsletter -->
              @if (config().newsletter?.enabled) {
                <div class="ep-footer__newsletter">
                  <h3 class="ep-footer__column-heading">
                    {{ config().newsletter!.heading ?? 'Subscribe to our newsletter' }}
                  </h3>
                  @if (newsletterSubmitted()) {
                    <p class="ep-footer__newsletter-thanks">
                      <i class="pi pi-check-circle text-[color:var(--ep-color-palmetto-700)]" aria-hidden="true"></i>
                      Thanks! Check your inbox to confirm.
                    </p>
                  } @else {
                    <form [formGroup]="newsletterForm" (ngSubmit)="onNewsletterSubmit()" class="ep-footer__newsletter-form">
                      <input
                        type="email"
                        formControlName="email"
                        class="ep-footer__newsletter-input"
                        [placeholder]="config().newsletter!.placeholder ?? 'you@example.com'"
                        aria-label="Email address"
                        required
                      />
                      <button
                        type="submit"
                        class="ep-footer__newsletter-btn"
                        [disabled]="newsletterForm.invalid"
                      >
                        {{ config().newsletter!.submitLabel ?? 'Subscribe' }}
                      </button>
                    </form>
                  }
                </div>
              }
            </div>

            @if (config().social?.length) {
              <ul class="ep-footer__social" role="list">
                @for (social of config().social!; track social.platform) {
                  <li>
                    <a
                      [href]="social.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ep-footer__social-link"
                      [attr.aria-label]="socialAriaLabel(social.platform)"
                    >
                      <i [class]="socialIcon(social.platform)" aria-hidden="true"></i>
                    </a>
                  </li>
                }
              </ul>
            }
          </div>
        </div>
      }

      <!-- ───── COMPLIANCE (full + minimal) ───── -->
      @if (showCompliance()) {
        <div class="ep-footer__compliance">
          <div class="ep-footer__container">
            @if (config().compliance!.badges?.length) {
              <ul class="ep-footer__badges" role="list" aria-label="Compliance certifications">
                @for (badge of config().compliance!.badges!; track badge) {
                  <li>
                    <span
                      class="ep-footer__badge"
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
            @if (config().compliance!.disclaimer) {
              <p class="ep-footer__disclaimer">{{ config().compliance!.disclaimer }}</p>
            }
          </div>
        </div>
      }

      <!-- ───── BOTTOM BAR (always) ───── -->
      <div class="ep-footer__bottom">
        <div class="ep-footer__container ep-footer__bottom-row">
          <div class="ep-footer__bottom-left">
            <span>© {{ copyrightYear() }} {{ config().bottomBar.copyrightOwner }}. All rights reserved.</span>
            @if (config().bottomBar.appVersion || config().bottomBar.buildId) {
              <span
                class="ep-footer__version-pill"
                [attr.title]="config().bottomBar.buildId ? 'Build ' + config().bottomBar.buildId : null"
              >
                @if (config().bottomBar.appVersion) {
                  <span>v{{ config().bottomBar.appVersion }}</span>
                }
                @if (config().bottomBar.appVersion && config().bottomBar.buildId) {
                  <span class="opacity-50">·</span>
                }
                @if (config().bottomBar.buildId) {
                  <span class="font-mono">{{ config().bottomBar.buildId!.slice(0, 7) }}</span>
                }
              </span>
            }
            @if (config().bottomBar.statusPageUrl) {
              <a
                [href]="config().bottomBar.statusPageUrl!"
                target="_blank"
                rel="noopener noreferrer"
                class="ep-footer__status"
                aria-label="System status (opens in a new tab)"
              >
                <span class="ep-footer__status-dot"></span>
                <span>All systems operational</span>
              </a>
            }
          </div>

          <div class="ep-footer__bottom-right">
            @if (config().bottomBar.links?.length) {
              <ul class="ep-footer__legal" role="list">
                @for (link of config().bottomBar.links!; track link.label) {
                  <li>
                    <ng-container *ngTemplateOutlet="footerLink; context: { $implicit: link }" />
                  </li>
                }
              </ul>
            }
            @if (config().bottomBar.languageSwitcher?.enabled) {
              <select
                class="ep-footer__lang"
                aria-label="Change language"
                (change)="onFooterLanguageChange($event)"
              >
                @for (lang of config().bottomBar.languageSwitcher!.languages; track lang.code) {
                  <option [value]="lang.code">
                    {{ lang.flagEmoji ? lang.flagEmoji + ' ' : '' }}{{ lang.label }}
                  </option>
                }
              </select>
            }
          </div>
        </div>
      </div>
    </footer>

    <!-- ───── COOKIE CONSENT BAR ───── -->
    @if (showCookieConsent()) {
      <div class="ep-cookie" role="region" aria-label="Cookie consent">
        <div class="ep-cookie__inner">
          <p class="ep-cookie__copy">
            <strong>We use cookies.</strong>
            By clicking "Accept all", you agree to the storing of cookies on your device for analytics + marketing.
            See our <a href="/cookies" class="underline">cookie policy</a>.
          </p>
          <div class="ep-cookie__actions">
            <button type="button" class="ep-cookie__btn ep-cookie__btn--ghost" (click)="rejectCookies()">
              Reject
            </button>
            <button type="button" class="ep-cookie__btn ep-cookie__btn--filled" (click)="acceptCookies()">
              Accept all
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Reusable link template (router / external / plain href) -->
    <ng-template #footerLink let-link>
      @if (link.routePath) {
        <a [routerLink]="link.routePath" class="ep-footer__link">{{ link.label }}</a>
      } @else if (link.externalUrl) {
        <a
          [href]="link.externalUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="ep-footer__link inline-flex items-center gap-1"
          [attr.aria-label]="link.label + ' (opens in a new tab)'"
        >
          {{ link.label }}
          <i class="pi pi-external-link text-[10px] opacity-60" aria-hidden="true"></i>
        </a>
      } @else {
        <a [href]="'#'" class="ep-footer__link">{{ link.label }}</a>
      }
    </ng-template>
  `,
  styles: [
    /*
     * BEM under .ep-footer / .ep-footer__*; every colour resolves through a
     * --ep-color-* token. prefers-reduced-motion disables the status-dot pulse.
     */
    `
      :host { display: block; }

      .ep-footer {
        margin-top: 3rem;
        background: linear-gradient(180deg, var(--ep-color-neutral-50) 0%, var(--ep-color-neutral-100) 100%);
        position: relative;
      }
      .ep-footer__container {
        margin: 0 auto;
        width: 100%;
        max-width: var(--ep-content-max);
        padding: 0 1rem;
      }
      @media (min-width: 640px) { .ep-footer__container { padding: 0 1.5rem; } }
      @media (min-width: 1024px) { .ep-footer__container { padding: 0 2rem; } }

      .ep-footer__accent {
        height: 4px;
        background: linear-gradient(
          90deg,
          var(--ep-color-primary-700) 0%,
          var(--ep-color-primary-500) 35%,
          var(--ep-color-palmetto-500) 65%,
          var(--ep-color-jessamine-500) 100%
        );
      }

      /* ── top section ── */
      .ep-footer__top { padding: 3rem 0; }
      .ep-footer__top-row {
        display: grid;
        gap: 2.5rem;
        grid-template-columns: 1fr;
      }
      @media (min-width: 1024px) {
        .ep-footer__top-row {
          grid-template-columns: minmax(0, 5fr) minmax(0, 6fr) minmax(0, 4fr);
        }
      }

      .ep-footer__brand { display: flex; gap: 0.875rem; align-items: flex-start; min-width: 0; }
      .ep-footer__brand > div { min-width: 0; }
      .ep-footer__brand-name,
      .ep-footer__brand-tag { word-break: break-word; }
      .ep-footer__brand-logo { display: block; border-radius: 0.5rem; }
      .ep-footer__brand-glyph {
        display: grid;
        place-items: center;
        width: 2.75rem;
        height: 2.75rem;
        border-radius: 0.5rem;
        background-color: var(--ep-color-primary-700);
        color: var(--ep-color-jessamine-500);
        font-size: 1.125rem;
        box-shadow: 0 4px 8px rgba(15, 31, 59, 0.1);
      }
      .ep-footer__brand-name {
        font-size: 1rem;
        font-weight: 600;
        color: var(--ep-color-neutral-900);
      }
      .ep-footer__brand-tag {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--ep-color-palmetto-700);
        margin-top: 0.125rem;
      }

      .ep-footer__columns {
        display: grid;
        gap: 2rem;
        grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
      }
      .ep-footer__column-heading {
        margin: 0 0 0.875rem;
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--ep-color-neutral-900);
      }
      .ep-footer__column-links {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.625rem;
      }

      /* newsletter */
      .ep-footer__newsletter-form {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }
      .ep-footer__newsletter-input {
        flex: 1;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--ep-color-neutral-300);
        border-radius: 0.375rem;
        font-size: 0.875rem;
        background-color: #fff;
      }
      .ep-footer__newsletter-input:focus-visible {
        outline: 2px solid var(--ep-color-primary-500);
        outline-offset: 2px;
        border-color: var(--ep-color-primary-500);
      }
      .ep-footer__newsletter-btn {
        padding: 0.5rem 0.875rem;
        background-color: var(--ep-color-primary-700);
        color: #fff;
        border-radius: 0.375rem;
        border: none;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 120ms ease;
      }
      .ep-footer__newsletter-btn:hover:not([disabled]) { background-color: var(--ep-color-primary-800); }
      .ep-footer__newsletter-btn[disabled] { opacity: 0.55; cursor: not-allowed; }
      .ep-footer__newsletter-btn:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }
      .ep-footer__newsletter-thanks {
        margin: 0.5rem 0 0;
        font-size: 0.8125rem;
        color: var(--ep-color-palmetto-800);
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
      }

      /* social */
      .ep-footer__social {
        list-style: none;
        padding: 0;
        margin: 1.5rem 0 0;
        display: flex;
        gap: 0.5rem;
      }
      .ep-footer__social-link {
        display: grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: 9999px;
        background-color: var(--ep-color-neutral-200);
        color: var(--ep-color-neutral-700);
        text-decoration: none;
        transition: background-color 120ms ease, color 120ms ease;
      }
      .ep-footer__social-link:hover {
        background-color: var(--ep-color-primary-700);
        color: #fff;
      }
      .ep-footer__social-link:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }

      /* compliance */
      .ep-footer__compliance {
        background-color: var(--ep-color-neutral-100);
        border-top: 1px solid var(--ep-color-neutral-200);
        padding: 1.5rem 0;
      }
      .ep-footer__badges {
        list-style: none;
        padding: 0;
        margin: 0 0 0.75rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .ep-footer__badge {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.25rem 0.625rem;
        border-radius: 9999px;
        background-color: #fff;
        border: 1px solid var(--ep-color-neutral-300);
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: var(--ep-color-neutral-700);
      }
      .ep-footer__badge i { color: var(--ep-color-primary-700); }
      .ep-footer__disclaimer {
        margin: 0;
        max-width: 50rem;
        font-size: 0.75rem;
        line-height: 1.5;
        color: var(--ep-color-neutral-600);
      }

      /* bottom bar */
      .ep-footer__bottom {
        background-color: var(--ep-color-neutral-100);
        border-top: 1px solid var(--ep-color-neutral-200);
      }
      .ep-footer__bottom-row {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem;
        font-size: 0.75rem;
        color: var(--ep-color-neutral-600);
      }
      @media (min-width: 768px) {
        .ep-footer__bottom-row {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
        }
      }
      .ep-footer__bottom-left {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
      }
      .ep-footer__version-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        background-color: var(--ep-color-primary-50);
        color: var(--ep-color-primary-800);
        font-size: 0.6875rem;
        font-weight: 500;
      }
      .ep-footer__status {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        background-color: var(--ep-color-palmetto-50);
        color: var(--ep-color-palmetto-800);
        font-size: 0.6875rem;
        font-weight: 500;
        text-decoration: none;
      }
      .ep-footer__status-dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 9999px;
        background-color: var(--ep-color-palmetto-500);
        animation: ep-footer-pulse 2s ease-in-out infinite;
      }
      @keyframes ep-footer-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.55; transform: scale(1.25); }
      }
      @media (prefers-reduced-motion: reduce) {
        .ep-footer__status-dot { animation: none; }
      }

      .ep-footer__bottom-right {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 1rem;
      }
      .ep-footer__legal {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .ep-footer__lang {
        appearance: none;
        background-color: #fff;
        color: var(--ep-color-neutral-800);
        font-size: 0.75rem;
        padding: 0.25rem 1.5rem 0.25rem 0.625rem;
        border: 1px solid var(--ep-color-neutral-300);
        border-radius: 0.375rem;
        cursor: pointer;
      }

      /* link styling */
      .ep-footer__link {
        color: var(--ep-color-neutral-700);
        text-decoration: none;
        transition: color 120ms ease;
      }
      .ep-footer__link:hover {
        color: var(--ep-color-primary-700);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .ep-footer__link:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
        border-radius: 2px;
      }

      /* ── cookie consent ── */
      .ep-cookie {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 999;
        background-color: color-mix(in srgb, var(--ep-color-neutral-900) 92%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        color: #fff;
        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.2);
      }
      .ep-cookie__inner {
        max-width: var(--ep-content-max);
        margin: 0 auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.875rem;
      }
      @media (min-width: 768px) {
        .ep-cookie__inner { flex-direction: row; align-items: center; justify-content: space-between; }
      }
      .ep-cookie__copy { margin: 0; font-size: 0.8125rem; max-width: 56rem; }
      .ep-cookie__copy a { color: var(--ep-color-jessamine-300); }
      .ep-cookie__actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
      .ep-cookie__btn {
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        border: none;
      }
      .ep-cookie__btn:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }
      .ep-cookie__btn--ghost {
        background-color: transparent;
        color: rgba(255, 255, 255, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.25);
      }
      .ep-cookie__btn--ghost:hover { background-color: rgba(255, 255, 255, 0.08); }
      .ep-cookie__btn--filled {
        background-color: var(--ep-color-jessamine-500);
        color: var(--ep-color-primary-900);
      }
      .ep-cookie__btn--filled:hover { background-color: var(--ep-color-jessamine-400); }
    `,
  ],
})
export class PlatformFooterComponent {
  private readonly fb = inject(FormBuilder);

  readonly config = input.required<FooterConfig>();
  readonly navAction = output<NavActionEvent>();

  protected readonly newsletterSubmitted = signal<boolean>(false);
  protected readonly cookieConsentDismissed = signal<boolean>(this.loadCookieDismissed());

  protected readonly newsletterForm: FormGroup = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly copyrightYear = computed(
    () => this.config().bottomBar.copyrightYear ?? new Date().getFullYear(),
  );

  /** Compliance section renders for full + minimal variants. */
  protected readonly showCompliance = computed(() => {
    if (this.config().variant === 'app') return false;
    const c = this.config().compliance;
    return !!c && (c.badges?.length || c.disclaimer);
  });

  /** Cookie bar shows iff configured + not yet dismissed. */
  protected readonly showCookieConsent = computed(() => {
    return (
      this.config().compliance?.cookieConsent === true &&
      !this.cookieConsentDismissed()
    );
  });

  protected badgeMeta(badge: ComplianceBadge): ComplianceMeta {
    return COMPLIANCE_META[badge];
  }

  protected socialIcon(platform: SocialPlatform): string {
    return SOCIAL_ICONS[platform] ?? 'pi pi-link';
  }

  protected socialAriaLabel(platform: SocialPlatform): string {
    return `${platform.charAt(0).toUpperCase() + platform.slice(1)} (opens in a new tab)`;
  }

  protected onNewsletterSubmit(): void {
    if (this.newsletterForm.invalid) return;
    const email = this.newsletterForm.getRawValue().email as string;
    const actionKey = this.config().newsletter?.actionKey ?? 'newsletter.subscribe';
    this.navAction.emit({
      source: 'newsletter',
      actionKey,
      payload: { email },
    });
    this.newsletterSubmitted.set(true);
  }

  protected onFooterLanguageChange(event: Event): void {
    const code = (event.target as HTMLSelectElement).value;
    this.navAction.emit({ source: 'menu', actionKey: 'language.change', payload: { code } });
  }

  protected acceptCookies(): void {
    this.persistCookieDismissed('accepted');
    this.cookieConsentDismissed.set(true);
  }

  protected rejectCookies(): void {
    this.persistCookieDismissed('rejected');
    this.cookieConsentDismissed.set(true);
  }

  // ── localStorage helpers — best-effort (Safari private mode no-ops) ───

  private loadCookieDismissed(): boolean {
    try {
      return !!localStorage.getItem(COOKIE_CONSENT_KEY);
    } catch {
      return false;
    }
  }

  private persistCookieDismissed(value: string): void {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, value);
    } catch {
      // No-op — banner will reappear next session.
    }
  }
}
