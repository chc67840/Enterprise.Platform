/**
 * ─── ConfirmDialogService — UNIT TESTS ──────────────────────────────────────────
 *
 * Verifies:
 *   - `ask()` resolves `true` when PrimeNG's `accept` callback is invoked.
 *   - `ask()` resolves `false` when PrimeNG's `reject` callback is invoked.
 *   - Severity affects header / icon / accept-label / button class / default focus.
 *   - `askDestructive()` is `ask({ severity: 'danger' })`.
 */
import { TestBed } from '@angular/core/testing';
import { ConfirmationService } from 'primeng/api';
import { describe, beforeEach, it, expect, vi } from 'vitest';

import { ConfirmDialogService } from './confirm-dialog.service';

describe('ConfirmDialogService', () => {
  let service: ConfirmDialogService;
  let primeConfirm: ConfirmationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ConfirmDialogService, ConfirmationService],
    });
    service = TestBed.inject(ConfirmDialogService);
    primeConfirm = TestBed.inject(ConfirmationService);
  });

  it('resolves true when accept callback fires', async () => {
    const spy = vi.spyOn(primeConfirm, 'confirm').mockImplementation((opts) => {
      opts?.accept?.();
      return primeConfirm;
    });

    await expect(service.ask({ message: 'Continue?' })).resolves.toBe(true);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('resolves false when reject callback fires', async () => {
    vi.spyOn(primeConfirm, 'confirm').mockImplementation((opts) => {
      opts?.reject?.();
      return primeConfirm;
    });

    await expect(service.ask({ message: 'Continue?' })).resolves.toBe(false);
  });

  it('uses defaults for info severity (default)', () => {
    const spy = vi.spyOn(primeConfirm, 'confirm').mockImplementation((opts) => {
      // capture; do not invoke callbacks so promise stays pending
      void opts;
      return primeConfirm;
    });
    void service.ask({ message: 'Continue?' });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        header: 'Confirm',
        icon: 'pi pi-question-circle',
        acceptLabel: 'Confirm',
        rejectLabel: 'Cancel',
        acceptButtonStyleClass: '',
        defaultFocus: 'accept',
      }),
    );
  });

  it('applies danger defaults: header, icon, accept label, button class, default focus', () => {
    const spy = vi.spyOn(primeConfirm, 'confirm').mockImplementation((opts) => {
      void opts;
      return primeConfirm;
    });
    void service.ask({ message: 'Delete?', severity: 'danger' });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        header: 'Confirm destructive action',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Delete',
        acceptButtonStyleClass: 'p-button-danger',
        defaultFocus: 'reject',
      }),
    );
  });

  it('respects caller-supplied overrides over severity defaults', () => {
    const spy = vi.spyOn(primeConfirm, 'confirm').mockImplementation((opts) => {
      void opts;
      return primeConfirm;
    });
    void service.ask({
      message: 'Custom?',
      severity: 'danger',
      header: 'Override Title',
      acceptLabel: 'Yes please',
      icon: 'pi pi-trash',
      defaultFocus: 'accept',
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        header: 'Override Title',
        acceptLabel: 'Yes please',
        icon: 'pi pi-trash',
        defaultFocus: 'accept',
      }),
    );
  });

  it('askDestructive() is equivalent to ask({ severity: "danger", ... })', () => {
    const spy = vi.spyOn(primeConfirm, 'confirm').mockImplementation((opts) => {
      void opts;
      return primeConfirm;
    });
    void service.askDestructive({ message: 'Drop the table?' });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptButtonStyleClass: 'p-button-danger',
        acceptLabel: 'Delete',
      }),
    );
  });

  it('forwards optional key to PrimeNG (multi-instance scenarios)', () => {
    const spy = vi.spyOn(primeConfirm, 'confirm').mockImplementation((opts) => {
      void opts;
      return primeConfirm;
    });
    void service.ask({ message: 'Scoped?', key: 'feature-x' });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ key: 'feature-x' }));
  });
});
