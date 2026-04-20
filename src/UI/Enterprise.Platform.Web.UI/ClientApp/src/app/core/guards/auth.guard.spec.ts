/**
 * ─── authGuard — UNIT TESTS ─────────────────────────────────────────────────────
 *
 * Proves:
 *   - Authenticated user → returns `true`.
 *   - Unauthenticated user → returns a `UrlTree` pointing at `/auth/login`
 *     with the attempted URL preserved as `returnUrl`.
 */
import { TestBed } from '@angular/core/testing';
import {
  Router,
  type RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '@core/auth/auth.service';

import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let router: Router;
  let auth: { isAuthenticated: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auth = { isAuthenticated: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
      ],
    });
    router = TestBed.inject(Router);
  });

  function runGuard(url: string): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url } as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  it('returns true when the user is authenticated', () => {
    auth.isAuthenticated.mockReturnValue(true);
    expect(runGuard('/protected')).toBe(true);
  });

  it('returns a UrlTree redirect with returnUrl when unauthenticated', () => {
    auth.isAuthenticated.mockReturnValue(false);
    const result = runGuard('/users/42');

    expect(result).toBeInstanceOf(UrlTree);
    const serialised = router.serializeUrl(result as UrlTree);
    expect(serialised).toContain('/auth/login');
    expect(serialised).toContain('returnUrl=%2Fusers%2F42');
  });
});
