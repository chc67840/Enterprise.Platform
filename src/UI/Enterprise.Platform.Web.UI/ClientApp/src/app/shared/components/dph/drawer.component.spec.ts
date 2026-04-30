/**
 * ─── DrawerComponent / resolveDrawerDimension — UNIT TESTS ──────────────────────
 *
 * The size-preset → CSS-dimension mapping is the meat of P1.2 and is
 * isolated as a pure function (`resolveDrawerDimension`) so it can be tested
 * without bootstrapping Angular's TestBed. The component itself is a thin
 * shell over `<p-drawer>` and is exercised E2E by the user-flows that open
 * drawers (filter panels, settings drawer, etc.).
 *
 * COVERAGE
 *   - All 5 size presets × 2 axes (left/right vs top/bottom) = 10 cases.
 *   - Direct width/height override beats size preset.
 *   - Legacy fallback when neither size nor direct dimension supplied.
 *   - `size: 'full'` resolves to viewport-relative units.
 */
import { describe, it, expect } from 'vitest';

import { resolveDrawerDimension } from './drawer.component';
import type { DrawerConfig, DrawerSize } from './dph.types';

describe('resolveDrawerDimension', () => {
  describe('size preset → width (horizontal drawers)', () => {
    const cases: Array<[DrawerSize, string]> = [
      ['sm', 'min(320px, 92vw)'],
      ['md', 'min(480px, 92vw)'],
      ['lg', 'min(640px, 92vw)'],
      ['xl', 'min(960px, 92vw)'],
      ['full', '100vw'],
    ];
    for (const [size, expected] of cases) {
      it(`size=${size} → width=${expected} (right)`, () => {
        expect(resolveDrawerDimension({ position: 'right', size })).toEqual({
          width: expected,
        });
      });
      it(`size=${size} → width=${expected} (left)`, () => {
        expect(resolveDrawerDimension({ position: 'left', size })).toEqual({
          width: expected,
        });
      });
    }
  });

  describe('size preset → height (vertical drawers)', () => {
    const cases: Array<[DrawerSize, string]> = [
      ['sm', 'min(320px, 80vh)'],
      ['md', 'min(480px, 80vh)'],
      ['lg', 'min(640px, 80vh)'],
      ['xl', 'min(960px, 80vh)'],
      ['full', '100vh'],
    ];
    for (const [size, expected] of cases) {
      it(`size=${size} → height=${expected} (top)`, () => {
        expect(resolveDrawerDimension({ position: 'top', size })).toEqual({
          height: expected,
        });
      });
      it(`size=${size} → height=${expected} (bottom)`, () => {
        expect(resolveDrawerDimension({ position: 'bottom', size })).toEqual({
          height: expected,
        });
      });
    }
  });

  it('uses legacy default width when neither width nor size set (horizontal)', () => {
    expect(resolveDrawerDimension({ position: 'right' })).toEqual({
      width: 'min(320px, 85vw)',
    });
    expect(resolveDrawerDimension({ position: 'left' })).toEqual({
      width: 'min(320px, 85vw)',
    });
  });

  it('uses legacy default height when neither height nor size set (vertical)', () => {
    expect(resolveDrawerDimension({ position: 'top' })).toEqual({
      height: 'min(360px, 70vh)',
    });
    expect(resolveDrawerDimension({ position: 'bottom' })).toEqual({
      height: 'min(360px, 70vh)',
    });
  });

  it('direct width wins over size preset for horizontal drawers', () => {
    expect(
      resolveDrawerDimension({ position: 'right', size: 'sm', width: '50%' }),
    ).toEqual({ width: '50%' });
    expect(
      resolveDrawerDimension({ position: 'left', size: 'xl', width: '720px' }),
    ).toEqual({ width: '720px' });
  });

  it('direct height wins over size preset for vertical drawers', () => {
    expect(
      resolveDrawerDimension({ position: 'top', size: 'lg', height: '40vh' }),
    ).toEqual({ height: '40vh' });
    expect(
      resolveDrawerDimension({ position: 'bottom', size: 'sm', height: '50%' }),
    ).toEqual({ height: '50%' });
  });

  it('horizontal config never produces a height key, vertical never a width key', () => {
    const h = resolveDrawerDimension({ position: 'right', size: 'md' });
    expect(h).not.toHaveProperty('height');
    expect(h).toHaveProperty('width');

    const v = resolveDrawerDimension({ position: 'top', size: 'md' });
    expect(v).not.toHaveProperty('width');
    expect(v).toHaveProperty('height');
  });

  it('returns a fresh object on each call (no shared-mutation hazard)', () => {
    const a = resolveDrawerDimension({ position: 'right', size: 'md' });
    const b = resolveDrawerDimension({ position: 'right', size: 'md' });
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('extra DrawerConfig fields (modal, header, etc.) do not affect dimension', () => {
    const cfg: DrawerConfig = {
      position: 'right',
      size: 'lg',
      modal: true,
      dismissableMask: false,
      closable: false,
      closeOnEscape: false,
      header: 'Anything',
      subheader: 'Anything else',
      footerDivider: false,
    };
    expect(resolveDrawerDimension(cfg)).toEqual({ width: 'min(640px, 92vw)' });
  });
});
