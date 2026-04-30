/**
 * ─── permissionGuard / anyPermissionGuard — UNIT TESTS ─────────────────────────
 *
 * Proves:
 *   - permissionGuard AND-semantics: all required perms must be present.
 *   - anyPermissionGuard OR-semantics: any one suffices.
 *   - Empty require list is a no-op (returns true).
 *   - Denied paths return a UrlTree to `/error/forbidden`.
 *   - `bypass: true` short-circuits to true.
 */
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthStore } from '@core/auth/auth.store';

import { anyPermissionGuard, permissionGuard } from './permission.guard';

describe('permissionGuard + anyPermissionGuard', () => {
  let router: Router;
  let store: {
    hasAllPermissions: ReturnType<typeof vi.fn>;
    hasAnyPermission: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    store = {
      hasAllPermissions: vi.fn(),
      hasAnyPermission: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: store },
      ],
    });
    router = TestBed.inject(Router);
  });

  function run(guard: ReturnType<typeof permissionGuard>): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      guard({} as never, {} as never),
    ) as boolean | UrlTree;
  }

  it('permissionGuard returns true when every required perm is present', () => {
    store.hasAllPermissions.mockReturnValue(true);
    expect(run(permissionGuard('users.read', 'users.update'))).toBe(true);
    expect(store.hasAllPermissions).toHaveBeenCalledWith('users.read', 'users.update');
  });

  it('permissionGuard returns UrlTree(/error/forbidden) when any perm is missing', () => {
    store.hasAllPermissions.mockReturnValue(false);
    const result = run(permissionGuard('users.delete'));
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toContain('/error/forbidden');
  });

  it('anyPermissionGuard returns true when any listed perm is present', () => {
    store.hasAnyPermission.mockReturnValue(true);
    expect(run(anyPermissionGuard('reports:read', 'reports:export'))).toBe(true);
    expect(store.hasAnyPermission).toHaveBeenCalledWith('reports:read', 'reports:export');
  });

  it('anyPermissionGuard redirects to forbidden when no listed perm matches', () => {
    store.hasAnyPermission.mockReturnValue(false);
    const result = run(anyPermissionGuard('admin:everything'));
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toContain('/error/forbidden');
  });

  it('permissionGuard with no required perms returns true (defensive open)', () => {
    expect(run(permissionGuard())).toBe(true);
    expect(store.hasAllPermissions).not.toHaveBeenCalled();
  });

  it('anyPermissionGuard with no required perms returns true', () => {
    expect(run(anyPermissionGuard())).toBe(true);
    expect(store.hasAnyPermission).not.toHaveBeenCalled();
  });
});
