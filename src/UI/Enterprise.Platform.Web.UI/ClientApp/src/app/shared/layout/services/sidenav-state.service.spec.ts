/**
 * SidenavStateService — pin desktop collapse + mobile drawer behaviour.
 *
 * `localStorage` is provided by jsdom. Each spec resets the persistence
 * key + the TestBed module so reads start from a known empty state.
 * Viewport size is faked through `window.matchMedia` because jsdom's
 * default has no real layout; we re-stub it per spec.
 */
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SIDENAV_COLLAPSED_KEY,
  SIDENAV_MOBILE_BREAKPOINT_PX,
  SidenavStateService,
} from './sidenav-state.service';

const realMatchMedia = window.matchMedia;

function setViewportMobile(isMobile: boolean): void {
  // jsdom doesn't implement matchMedia — stub it to control viewport
  // membership. The service queries `(max-width: 768px)`; we return
  // matches=true for mobile and false for desktop.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: isMobile && query.includes(`max-width: ${SIDENAV_MOBILE_BREAKPOINT_PX}px`),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe('SidenavStateService', () => {
  beforeEach(() => {
    window.localStorage.removeItem(SIDENAV_COLLAPSED_KEY);
    TestBed.resetTestingModule();
    setViewportMobile(false);
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: realMatchMedia,
    });
  });

  describe('desktop collapse state', () => {
    it('defaults to expanded (collapsed=false) on first visit', () => {
      const svc = TestBed.inject(SidenavStateService);
      expect(svc.collapsed()).toBe(false);
    });

    it('restores collapsed=true from localStorage', () => {
      window.localStorage.setItem(SIDENAV_COLLAPSED_KEY, '1');
      const svc = TestBed.inject(SidenavStateService);
      expect(svc.collapsed()).toBe(true);
    });

    it('toggle() flips and persists collapsed state on desktop', () => {
      const svc = TestBed.inject(SidenavStateService);
      expect(svc.collapsed()).toBe(false);

      svc.toggle();
      expect(svc.collapsed()).toBe(true);
      expect(window.localStorage.getItem(SIDENAV_COLLAPSED_KEY)).toBe('1');

      svc.toggle();
      expect(svc.collapsed()).toBe(false);
      expect(window.localStorage.getItem(SIDENAV_COLLAPSED_KEY)).toBe('0');
    });

    it('setCollapsed() force-sets and persists', () => {
      const svc = TestBed.inject(SidenavStateService);
      svc.setCollapsed(true);
      expect(svc.collapsed()).toBe(true);
      expect(window.localStorage.getItem(SIDENAV_COLLAPSED_KEY)).toBe('1');
    });

    it('treats unrecognised localStorage values as "not set"', () => {
      window.localStorage.setItem(SIDENAV_COLLAPSED_KEY, 'garbage');
      const svc = TestBed.inject(SidenavStateService);
      expect(svc.collapsed()).toBe(false);
    });
  });

  describe('mobile drawer state', () => {
    beforeEach(() => {
      setViewportMobile(true);
      TestBed.resetTestingModule();
    });

    it('defaults to closed (mobileOpen=false)', () => {
      const svc = TestBed.inject(SidenavStateService);
      expect(svc.mobileOpen()).toBe(false);
    });

    it('toggle() flips mobileOpen on mobile viewport', () => {
      const svc = TestBed.inject(SidenavStateService);
      svc.toggle();
      expect(svc.mobileOpen()).toBe(true);

      svc.toggle();
      expect(svc.mobileOpen()).toBe(false);
    });

    it('toggle() does NOT touch desktop collapsed state on mobile', () => {
      const svc = TestBed.inject(SidenavStateService);
      const collapsedBefore = svc.collapsed();
      svc.toggle();
      expect(svc.collapsed()).toBe(collapsedBefore);
      expect(window.localStorage.getItem(SIDENAV_COLLAPSED_KEY)).toBe(null);
    });

    it('closeMobile() sets mobileOpen to false', () => {
      const svc = TestBed.inject(SidenavStateService);
      svc.toggle();
      expect(svc.mobileOpen()).toBe(true);

      svc.closeMobile();
      expect(svc.mobileOpen()).toBe(false);
    });

    it('mobileOpen state does not persist across service re-creation', () => {
      const first = TestBed.inject(SidenavStateService);
      first.toggle();
      expect(first.mobileOpen()).toBe(true);

      TestBed.resetTestingModule();
      const second = TestBed.inject(SidenavStateService);
      expect(second.mobileOpen()).toBe(false);
    });
  });
});
