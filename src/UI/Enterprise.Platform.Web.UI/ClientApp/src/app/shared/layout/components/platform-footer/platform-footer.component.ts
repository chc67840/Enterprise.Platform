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

import { STORAGE_KEYS } from '@constants';
import type {
  ComplianceBadge,
  FooterConfig,
  FooterLink,
  NavActionEvent,
  SocialPlatform,
} from '@shared/layout';

const COOKIE_CONSENT_KEY = STORAGE_KEYS.COOKIE_CONSENT;

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
  styleUrl: './platform-footer.component.scss',
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
