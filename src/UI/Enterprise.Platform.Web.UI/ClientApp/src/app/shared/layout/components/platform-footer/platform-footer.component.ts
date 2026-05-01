/**
 * Composable, config-driven footer. Stamps each section block in document
 * order; domains opt in by populating fields on the FooterConfig literal.
 * `variant` is a preset that hides whole sets of blocks for dense surfaces.
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
  FooterVariant,
  NavActionEvent,
  SocialPlatform,
} from '@shared/layout';

const COOKIE_CONSENT_KEY = STORAGE_KEYS.COOKIE_CONSENT;

// Default copy when the corresponding config field is absent. Centralised
// here so a single edit (or a future i18n provider) covers the chrome.
const DEFAULT_NEWSLETTER_THANKS = 'Thanks! Check your inbox to confirm.';
const DEFAULT_STATUS_LABEL = 'All systems operational';
const DEFAULT_COOKIE_BODY =
  'By clicking "Accept all", you agree to the storing of cookies on your device for analytics + marketing.';
const DEFAULT_COOKIE_ACCEPT = 'Accept all';
const DEFAULT_COOKIE_REJECT = 'Reject';
const DEFAULT_COOKIE_POLICY_URL = '/cookies';
const DEFAULT_COOKIE_POLICY_LABEL = 'cookie policy';

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
  rss: 'pi pi-rss',
  tiktok: 'pi pi-volume-up',
  pinterest: 'pi pi-bookmark',
};

@Component({
  selector: 'app-platform-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ReactiveFormsModule, RouterLink, TooltipModule],
  template: `
    <footer
      class="ep-footer"
      [class.ep-footer--full]="variant() === 'full'"
      [class.ep-footer--minimal]="variant() === 'minimal'"
      [class.ep-footer--app]="variant() === 'app'"
      role="contentinfo"
    >
      <!-- ── BRAND + SOCIAL + COLUMNS + NEWSLETTER ── -->
      @if (showTopRow()) {
        <div class="ep-footer__top">
          <div class="ep-footer__container ep-footer__top-row">
            @if (config().brand; as brand) {
              <div class="ep-footer__brand">
                @if (brand.imageSrc) {
                  @if (brand.homeRoute) {
                    <a [routerLink]="brand.homeRoute" class="ep-footer__brand-link" [attr.aria-label]="brand.alt">
                      <img [src]="brand.imageSrc" [alt]="brand.alt" loading="lazy" class="ep-footer__brand-logo" />
                    </a>
                  } @else {
                    <img [src]="brand.imageSrc" [alt]="brand.alt" loading="lazy" class="ep-footer__brand-logo" />
                  }
                } @else {
                  <span class="ep-footer__brand-glyph" aria-hidden="true"><i class="pi pi-bolt"></i></span>
                }
                <div class="ep-footer__brand-text">
                  @if (brand.brandName) {
                    <div class="ep-footer__brand-name">{{ brand.brandName }}</div>
                  }
                  @if (brand.tagline) {
                    <div class="ep-footer__brand-tag">{{ brand.tagline }}</div>
                  }
                  @if (brand.addressLines?.length && brand.addressLines; as addressLines) {
                    <address class="ep-footer__address">
                      @for (line of addressLines; track line) {
                        <span class="ep-footer__address-line">{{ line }}</span>
                      }
                    </address>
                  }
                </div>
              </div>
            }

            @if (showSocialZone()) {
              <div class="ep-footer__social">
                @if (config().social; as social) {
                  @if (social.links.length) {
                    @if (social.heading) {
                      <span class="ep-footer__social-heading">{{ social.heading }}</span>
                    }
                    <ul class="ep-footer__social-list" role="list">
                      @for (link of social.links; track link.platform) {
                        <li>
                          <a
                            [href]="link.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="ep-footer__social-link"
                            [attr.aria-label]="link.ariaLabel ?? socialAriaLabel(link.platform)"
                          >
                            <i [class]="socialIcon(link.platform)" aria-hidden="true"></i>
                          </a>
                        </li>
                      }
                    </ul>
                  }
                }
                @if (config().accreditation; as ac) {
                  <div class="ep-footer__accreditation-inline">
                    @if (ac.externalUrl) {
                      <a [href]="ac.externalUrl" target="_blank" rel="noopener noreferrer" class="ep-footer__accreditation-link">
                        <img
                          [src]="ac.imageSrc"
                          [alt]="ac.imageAlt"
                          [width]="ac.imageWidthPx ?? 96"
                          loading="lazy"
                          class="ep-footer__accreditation-img"
                        />
                      </a>
                    } @else {
                      <img
                        [src]="ac.imageSrc"
                        [alt]="ac.imageAlt"
                        [width]="ac.imageWidthPx ?? 96"
                        loading="lazy"
                        class="ep-footer__accreditation-img"
                      />
                    }
                    @if (ac.caption) {
                      <p class="ep-footer__accreditation-caption">{{ ac.caption }}</p>
                    }
                  </div>
                }
              </div>
            }

            @if (config().columns?.length && config().columns; as columns) {
              <div class="ep-footer__columns">
                @for (column of columns; track column.heading || $index) {
                  <div
                    class="ep-footer__column"
                    [class.ep-footer__column--highlight]="column.tone === 'highlight'"
                  >
                    @if (column.heading) {
                      <h3 class="ep-footer__column-heading">{{ column.heading }}</h3>
                    }
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

            @if (config().newsletter; as newsletter) {
              @if (newsletter.enabled) {
                <div class="ep-footer__newsletter">
                  <h3 class="ep-footer__column-heading">
                    {{ newsletter.heading ?? 'Subscribe to our newsletter' }}
                  </h3>
                  @if (newsletterSubmitted()) {
                    <p class="ep-footer__newsletter-thanks">
                      <i class="pi pi-check-circle text-[color:var(--ep-color-palmetto-700)]" aria-hidden="true"></i>
                      {{ newsletterThanksMessage() }}
                    </p>
                  } @else {
                    <form [formGroup]="newsletterForm" (ngSubmit)="onNewsletterSubmit()" class="ep-footer__newsletter-form">
                      <input
                        type="email"
                        formControlName="email"
                        class="ep-footer__newsletter-input"
                        [placeholder]="newsletter.placeholder ?? 'you@example.com'"
                        aria-label="Email address"
                        required
                      />
                      <button
                        type="submit"
                        class="ep-footer__newsletter-btn"
                        [disabled]="newsletterForm.invalid"
                      >
                        {{ newsletter.submitLabel ?? 'Subscribe' }}
                      </button>
                    </form>
                  }
                </div>
              }
            }
          </div>
        </div>
      }

      <!-- ── COMPLIANCE (full + minimal) ── -->
      @if (showCompliance() && config().compliance; as compliance) {
        <div class="ep-footer__compliance">
          <div class="ep-footer__container">
            @if (compliance.badges?.length && compliance.badges; as badges) {
              <ul class="ep-footer__badges" role="list" aria-label="Compliance certifications">
                @for (badge of badges; track badge) {
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
            @if (compliance.disclaimer; as disclaimer) {
              <p class="ep-footer__disclaimer">{{ disclaimer }}</p>
            }
          </div>
        </div>
      }

      <!-- ── UTILITY BAR (full + minimal) ── -->
      @if (showUtilityBar() && config().utilityBar; as ub) {
        <div class="ep-footer__utility">
          <div class="ep-footer__container">
            <ul class="ep-footer__utility-list" role="list">
              @for (link of ub.links; track link.label) {
                <li>
                  <ng-container *ngTemplateOutlet="footerLink; context: { $implicit: link }" />
                </li>
              }
            </ul>
          </div>
        </div>
      }

      <!-- ── COPYRIGHT (always — every variant) ── -->
      <div class="ep-footer__copyright">
        <div class="ep-footer__container">
          <p class="ep-footer__copyright-text">{{ copyrightText() }}</p>
        </div>
      </div>

      <!-- ── META: version / build / status-page (full only) ── -->
      @if (showMeta() && config().meta; as meta) {
        <div class="ep-footer__meta">
          <div class="ep-footer__container ep-footer__meta-row">
            @if (meta.appVersion || meta.buildId) {
              <span
                class="ep-footer__version-pill"
                [attr.title]="meta.buildId ? 'Build ' + meta.buildId : null"
              >
                @if (meta.appVersion) { <span>v{{ meta.appVersion }}</span> }
                @if (meta.appVersion && meta.buildId) { <span class="opacity-50">·</span> }
                @if (meta.buildId) {
                  <span class="font-mono">{{ meta.buildId.slice(0, 7) }}</span>
                }
              </span>
            }
            @if (meta.statusPageUrl) {
              <a
                [href]="meta.statusPageUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="ep-footer__status"
                aria-label="System status (opens in a new tab)"
              >
                <span class="ep-footer__status-dot"></span>
                <span>{{ meta.statusLabel ?? defaultStatusLabel }}</span>
              </a>
            }
            @if (meta.languageSwitcher; as langSwitcher) {
              @if (langSwitcher.enabled) {
                <select
                  class="ep-footer__lang"
                  aria-label="Change language"
                  (change)="onFooterLanguageChange($event)"
                >
                  @for (lang of langSwitcher.languages; track lang.code) {
                    <option [value]="lang.code">
                      {{ lang.flagEmoji ? lang.flagEmoji + ' ' : '' }}{{ lang.label }}
                    </option>
                  }
                </select>
              }
            }
          </div>
        </div>
      }

      <!-- ── FLAG (full only) ── -->
      @if (showFlag() && config().flag; as flag) {
        <div class="ep-footer__flag">
          <img
            [src]="flag.imageSrc"
            [alt]="flag.alt"
            [height]="flag.heightPx ?? 16"
            loading="lazy"
            class="ep-footer__flag-img"
          />
        </div>
      }
    </footer>

    <!-- ── COOKIE CONSENT ── -->
    @if (showCookieConsent()) {
      <div class="ep-cookie" role="region" aria-label="Cookie consent">
        <div class="ep-cookie__inner">
          <p class="ep-cookie__copy">
            <strong>We use cookies.</strong>
            {{ cookieBody() }}
            See our <a [href]="cookiePolicyUrl()" class="underline">{{ cookiePolicyLabel() }}</a>.
          </p>
          <div class="ep-cookie__actions">
            <button type="button" class="ep-cookie__btn ep-cookie__btn--ghost" (click)="rejectCookies()">
              {{ cookieRejectLabel() }}
            </button>
            <button type="button" class="ep-cookie__btn ep-cookie__btn--filled" (click)="acceptCookies()">
              {{ cookieAcceptLabel() }}
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

  protected readonly variant = computed<FooterVariant>(() => this.config().variant);

  /** Default fallback exposed to the template (status pill copy). */
  protected readonly defaultStatusLabel = DEFAULT_STATUS_LABEL;

  protected readonly newsletterThanksMessage = computed(
    () => this.config().newsletter?.thanksMessage ?? DEFAULT_NEWSLETTER_THANKS,
  );

  protected readonly cookieBody = computed(
    () => this.config().compliance?.cookieConsentLabels?.body ?? DEFAULT_COOKIE_BODY,
  );
  protected readonly cookieAcceptLabel = computed(
    () => this.config().compliance?.cookieConsentLabels?.acceptLabel ?? DEFAULT_COOKIE_ACCEPT,
  );
  protected readonly cookieRejectLabel = computed(
    () => this.config().compliance?.cookieConsentLabels?.rejectLabel ?? DEFAULT_COOKIE_REJECT,
  );
  protected readonly cookiePolicyUrl = computed(
    () => this.config().compliance?.cookieConsentLabels?.policyUrl ?? DEFAULT_COOKIE_POLICY_URL,
  );
  protected readonly cookiePolicyLabel = computed(
    () => this.config().compliance?.cookieConsentLabels?.policyLabel ?? DEFAULT_COOKIE_POLICY_LABEL,
  );

  /**
   * Rendered copyright string. Tolerates a missing `copyright` block (e.g.
   * a legacy-shape wire response mid-deployment) by falling back to a
   * year-only line — the chrome still renders rather than crashing.
   */
  protected readonly copyrightText = computed(() => {
    const c = this.config().copyright;
    if (c?.text) return c.text;
    const year = c?.year ?? new Date().getFullYear();
    if (!c?.owner) return `© ${year}`;
    return `© ${year} ${c.owner}. All rights reserved.`;
  });

  protected readonly showTopRow = computed(
    () =>
      this.variant() === 'full' &&
      !!(
        this.config().brand ||
        this.config().social?.links?.length ||
        this.config().accreditation ||
        this.config().columns?.length ||
        this.config().newsletter?.enabled
      ),
  );

  /**
   * Social column renders whenever social links OR an accreditation badge
   * is configured — the accreditation lives inside the social zone (below
   * the icons) per the agency-footer layout spec.
   */
  protected readonly showSocialZone = computed(
    () => !!(this.config().social?.links?.length || this.config().accreditation),
  );

  protected readonly showCompliance = computed(() => {
    if (this.variant() === 'app') return false;
    const c = this.config().compliance;
    return !!c && !!(c.badges?.length || c.disclaimer);
  });

  protected readonly showUtilityBar = computed(() => {
    if (this.variant() === 'app') return false;
    return !!this.config().utilityBar?.links?.length;
  });

  protected readonly showMeta = computed(() => {
    if (this.variant() !== 'full') return false;
    const m = this.config().meta;
    return !!m && !!(m.appVersion || m.buildId || m.statusPageUrl || m.languageSwitcher?.enabled);
  });

  protected readonly showFlag = computed(
    () => this.variant() === 'full' && !!this.config().flag,
  );

  protected readonly showCookieConsent = computed(
    () =>
      this.config().compliance?.cookieConsent === true &&
      !this.cookieConsentDismissed(),
  );

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
    this.navAction.emit({ source: 'newsletter', actionKey, payload: { email } });
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
      /* swallow — banner will reappear next session */
    }
  }
}
