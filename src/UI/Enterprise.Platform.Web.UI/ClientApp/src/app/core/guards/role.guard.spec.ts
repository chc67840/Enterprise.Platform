/**
 * ─── roleGuard — UNIT TESTS ─────────────────────────────────────────────────────
 *
 * Proves OR-semantics across roles, empty-list defensive open, and UrlTree
 * redirect to `/error/forbidden` on denial.
 */
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthStore } from '@core/auth/auth.store';

import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  let router: Router;
  let store: { hasAnyRole: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    store = { hasAnyRole: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: store },
      ],
    });
    router = TestBed.inject(Router);
  });

  function run(guard: ReturnType<typeof roleGuard>): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      guard({} as never, {} as never),
    ) as boolean | UrlTree;
  }

  it('returns true when any allowed role is present', () => {
    store.hasAnyRole.mockReturnValue(true);
    expect(run(roleGuard('admin', 'manager'))).toBe(true);
    expect(store.hasAnyRole).toHaveBeenCalledWith('admin', 'manager');
  });

  it('returns UrlTree(/error/forbidden) when no role matches', () => {
    store.hasAnyRole.mockReturnValue(false);
    const result = run(roleGuard('admin'));
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toContain('/error/forbidden');
  });

  it('returns true when no roles are specified (defensive open)', () => {
    expect(run(roleGuard())).toBe(true);
    expect(store.hasAnyRole).not.toHaveBeenCalled();
  });
});
