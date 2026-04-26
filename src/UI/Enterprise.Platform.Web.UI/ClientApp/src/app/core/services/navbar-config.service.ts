/**
 * ─── core/services/navbar-config.service ────────────────────────────────────────
 *
 * Single signal-backed source for the active `DomainChromeConfig`. The shell
 * subscribes via signals; everything reactive flows from here:
 *
 *   - Domain change (`DomainStore.currentDomain()` flips) → reload
 *   - Auth state change (sign in / sign out / role grant) → reload
 *   - Manual `refresh()` (e.g. after admin grants the user a new permission)
 *
 * The service hides which provider is wired (static vs backend) — feature
 * code reads `service.navbar()` and `service.footer()` regardless.
 *
 * STATE
 *   - `loading()`     — first load in flight (true → false on first success/fail)
 *   - `error()`       — last error from the provider, or null
 *   - `lastKnown()`   — last successful config (used as fallback while
 *                       refreshing or on transient error)
 *   - `navbar()` / `footer()` — current view-of-truth, prefers fresh value
 *                       and falls back to lastKnown on error
 *
 * PRINCIPLE
 *   The shell never sees `null` for `navbar()`/`footer()` after first load
 *   completes — even on error we fall back to the last-known good config so
 *   the UI doesn't flash empty chrome. First-time errors fall through to
 *   the static `DOMAIN_CHROME_REGISTRY[domain]` snapshot.
 */
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { AuthService } from '@core/auth';
import { AuthStore } from '@core/auth/auth.store';

import { DOMAIN_CHROME_REGISTRY, type DomainKey } from '@shared/layout/domains';
import {
  type DomainChromeConfig,
  type FooterConfig,
  type NavbarConfig,
  type UserProfile,
} from '@shared/layout';
import { NAVBAR_CONFIG_PROVIDER } from '@shared/layout/providers';

import { DomainStore } from './domain.store';

@Injectable({ providedIn: 'root' })
export class NavbarConfigService {
  private readonly provider = inject(NAVBAR_CONFIG_PROVIDER);
  private readonly domains = inject(DomainStore);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  /**
   * Captured at construction so `takeUntilDestroyed(destroyRef)` works from
   * `fetch()` — which is invoked from the `_autoReload` effect callback and
   * from the public `refresh()` method, neither of which runs in injection
   * context. The arg-less overload would NG0203 there.
   */
  private readonly destroyRef = inject(DestroyRef);

  // ── state signals ──────────────────────────────────────────────────────

  /** First load in flight. Toggles to false after the first response (success or failure). */
  readonly loading = signal<boolean>(true);

  /** Last error from the provider; null when most recent load succeeded. */
  readonly error = signal<unknown | null>(null);

  /** Last successful config — survives transient errors as the fallback. */
  private readonly lastKnown = signal<DomainChromeConfig | null>(null);

  /**
   * Current chrome — prefers the freshest successful response; falls back
   * to lastKnown on error; falls through to the static registry as the
   * absolute last resort. Never null after boot.
   */
  readonly chrome = computed<DomainChromeConfig>(() => {
    const fresh = this.lastKnown();
    if (fresh) return fresh;
    return DOMAIN_CHROME_REGISTRY[this.domains.currentDomain()];
  });

  readonly navbar = computed<NavbarConfig>(() => this.chrome().navbar);
  readonly footer = computed<FooterConfig>(() => this.chrome().footer);

  /**
   * Reactive auto-reload. Re-fires whenever the domain changes OR the user
   * authentication state changes. The provider gets the current snapshot
   * so the BFF impl can include user identity in the request.
   */
  private readonly _autoReload = effect(() => {
    const domain = this.domains.currentDomain();
    const user = this.currentUser();
    this.fetch(domain, user);
  });

  /** Force a reload (e.g. after a permission grant in admin tooling). */
  refresh(): void {
    this.fetch(this.domains.currentDomain(), this.currentUser());
  }

  // ── internals ──────────────────────────────────────────────────────────

  /** Adapter: AuthService signals → UserProfile shape (or null when unauthenticated). */
  private currentUser(): UserProfile | null {
    if (!this.authService.isAuthenticated()) return null;
    return {
      id: '',
      displayName: this.authService.displayName() || this.authService.email(),
      email: this.authService.email(),
      role: this.authStore.roles()[0],
    };
  }

  private fetch(domain: DomainKey, user: UserProfile | null): void {
    this.loading.set(true);
    this.provider
      .load({ domain, user })
      .pipe(
        catchError((err) => {
          this.error.set(err);
          return of<DomainChromeConfig | null>(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((cfg) => {
        if (cfg) {
          this.lastKnown.set(cfg);
          this.error.set(null);
        }
        this.loading.set(false);
      });
  }
}
