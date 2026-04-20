/**
 * Vitest setup — runs once per test process before any spec file.
 *
 * Angular tests under Vitest + jsdom need:
 *   1. `@angular/compiler` imported before anything else so the JIT compiler
 *      is available for partial-compiled libraries (`@angular/common`
 *      ships partial-IVY output expected to be linked or JIT-compiled).
 *   2. `TestBed` bootstrapped against `BrowserTestingModule` so
 *      `configureTestingModule(...)` has a platform to attach to.
 *
 * Keeping both calls here means spec files don't need to repeat the boilerplate
 * and can jump straight to `TestBed.configureTestingModule({...})`.
 */
import '@angular/compiler';

import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
  // Let TestBed destroy per spec so module state doesn't leak between cases.
  teardown: { destroyAfterEach: true },
});
