/**
 * ─── CustomPreloader — UNIT TESTS ──────────────────────────────────────────────
 *
 * Proves:
 *   - Routes without `data.preload === true` → `EMPTY` (never loads).
 *   - Routes with `data.preload === true` → `load()` invoked.
 *   - `navigator.connection.saveData === true` → skip even when tagged.
 *   - Missing `navigator.connection` (Firefox / Safari) → proceed with preload.
 */
import { TestBed } from '@angular/core/testing';
import { type Route } from '@angular/router';
import { EMPTY, lastValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomPreloader } from './custom-preloader';

describe('CustomPreloader', () => {
  let preloader: CustomPreloader;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    preloader = TestBed.inject(CustomPreloader);
  });

  afterEach(() => {
    // Clear any `navigator.connection` stubbing between specs.
    delete (navigator as unknown as { connection?: unknown }).connection;
  });

  function makeRoute(data?: Record<string, unknown>): Route {
    return { path: 'thing', data };
  }

  function makeLoader() {
    const load = vi.fn(() => of({ loaded: true }));
    return load;
  }

  it('returns EMPTY for routes without data.preload flag', async () => {
    const load = makeLoader();
    const result = preloader.preload(makeRoute(), load);
    expect(result).toBe(EMPTY);
    expect(load).not.toHaveBeenCalled();
  });

  it('returns EMPTY when data.preload is not strictly true', async () => {
    const load = makeLoader();
    expect(preloader.preload(makeRoute({ preload: 'yes' }), load)).toBe(EMPTY);
    expect(preloader.preload(makeRoute({ preload: 1 }), load)).toBe(EMPTY);
    expect(load).not.toHaveBeenCalled();
  });

  it('invokes load() when data.preload === true and saveData is off', async () => {
    const load = makeLoader();
    const result = preloader.preload(makeRoute({ preload: true }), load);
    expect(result).not.toBe(EMPTY);
    expect(load).toHaveBeenCalledOnce();
    const value = await lastValueFrom(result);
    expect(value).toEqual({ loaded: true });
  });

  it('skips preload when navigator.connection.saveData is true', async () => {
    (navigator as unknown as { connection: { saveData: boolean } }).connection = {
      saveData: true,
    };

    const load = makeLoader();
    expect(preloader.preload(makeRoute({ preload: true }), load)).toBe(EMPTY);
    expect(load).not.toHaveBeenCalled();
  });

  it('proceeds with preload when connection.saveData is explicitly false', async () => {
    (navigator as unknown as { connection: { saveData: boolean } }).connection = {
      saveData: false,
    };
    const load = makeLoader();
    const result = preloader.preload(makeRoute({ preload: true }), load);
    expect(result).not.toBe(EMPTY);
    expect(load).toHaveBeenCalledOnce();
  });
});
