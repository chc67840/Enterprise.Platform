/**
 * ─── unsavedChangesGuard — UNIT TESTS ───────────────────────────────────────────
 *
 * Proves:
 *   - `hasUnsavedChanges() === false` → allow leave (returns true).
 *   - `hasUnsavedChanges() === true` + user confirms → allow leave.
 *   - User cancels the confirm → block leave.
 *   - Custom message is forwarded to `window.confirm` when provided.
 */
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    confirmSpy = vi.spyOn(window, 'confirm');
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  const run = (component: { hasUnsavedChanges?: () => boolean; getUnsavedChangesMessage?: () => string }) =>
    TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(component as never, {} as never, {} as never, {} as never),
    );

  it('allows navigation when the component reports clean', () => {
    expect(run({ hasUnsavedChanges: () => false })).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('prompts and returns the confirm result when dirty', () => {
    confirmSpy.mockReturnValue(true);
    expect(run({ hasUnsavedChanges: () => true })).toBe(true);

    confirmSpy.mockReturnValue(false);
    expect(run({ hasUnsavedChanges: () => true })).toBe(false);
  });

  it('uses the custom message when the component supplies one', () => {
    confirmSpy.mockReturnValue(true);
    run({
      hasUnsavedChanges: () => true,
      getUnsavedChangesMessage: () => 'Custom — leave anyway?',
    });
    expect(confirmSpy).toHaveBeenCalledWith('Custom — leave anyway?');
  });

  it('allows navigation when the component has no hasUnsavedChanges method', () => {
    expect(run({})).toBe(true);
  });
});
