/**
 * ─── ConfirmDialogService ───────────────────────────────────────────────────────
 *
 * Promise-based wrapper around PrimeNG's `ConfirmationService`. Replaces the
 * callback-based `accept: () => …, reject: () => …` ergonomics with a
 * `Promise<boolean>` so callers can write:
 *
 *   if (await this.confirm.ask({ message: 'Delete this user?' })) { ... }
 *
 * instead of nesting their post-confirm logic inside an `accept` lambda.
 *
 * RUNTIME REQUIREMENT
 *   PrimeNG's `ConfirmationService` only fires the confirm dialog when a
 *   `<p-confirmDialog />` component is mounted somewhere in the rendered
 *   tree. The host page MUST render one. Convention: place it once at the
 *   feature-route root (e.g. inside `users-list.component.ts`), or inside
 *   the global `app-shell` template if confirms are used app-wide.
 *
 * SEVERITY MAPPING
 *   `severity` is a UX hint, NOT just a colour:
 *     - `info`   — neutral confirm (default).
 *     - `success`/`warn` — accent-coloured accept button.
 *     - `danger` — accept button rendered with `p-button-danger` class
 *                  (red), and the icon defaults to `pi pi-exclamation-triangle`
 *                  so destructive actions read as destructive.
 *
 * DEFAULT FOCUS
 *   Defaults to `'reject'` (the safer side) for `severity: 'danger'`, and
 *   `'accept'` for everything else. Override via `defaultFocus`.
 *
 * KEYBOARD
 *   Esc dismisses (resolves `false`); Enter triggers the focused button.
 *   Inherited from PrimeNG defaults.
 *
 * ACCESSIBILITY
 *   PrimeNG's confirm dialog ships `role="alertdialog"` and traps focus
 *   inside the dialog — no extra wiring required. The `<p-confirmDialog>`
 *   element auto-receives an `aria-modal="true"` while open.
 */
import { Injectable, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';

export type ConfirmSeverity = 'info' | 'success' | 'warn' | 'danger';

export interface ConfirmOptions {
  /** Message body — required. Plain text; HTML is escaped. */
  readonly message: string;
  /** Header / title; defaults to "Confirm" / "Confirm action" by severity. */
  readonly header?: string;
  /** Accept button label. Defaults to "Confirm" / "Delete" by severity. */
  readonly acceptLabel?: string;
  /** Reject button label. Defaults to "Cancel". */
  readonly rejectLabel?: string;
  /** PrimeIcons class for the leading icon. Defaults vary by severity. */
  readonly icon?: string;
  /**
   * Severity affects:
   *   - default header / accept label / icon
   *   - accept button colour (`danger` → `p-button-danger`)
   *   - default focused button (`danger` → `'reject'`)
   */
  readonly severity?: ConfirmSeverity;
  /** Which button receives initial focus. */
  readonly defaultFocus?: 'accept' | 'reject';
  /**
   * PrimeNG `ConfirmationService` supports a `key` to scope a confirmation
   * to a specific `<p-confirmDialog [key]="...">` instance — useful when
   * an app has multiple dialog instances mounted simultaneously (rare).
   * Omit for the default unkeyed dialog.
   */
  readonly key?: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly primeConfirm = inject(ConfirmationService);

  /**
   * Show the confirm dialog and resolve `true` on accept, `false` on
   * reject (including dismiss / Esc / mask click).
   *
   * The dialog must be mounted in the rendered tree as `<p-confirmDialog />`.
   * If it isn't, the Promise will hang forever (no PrimeNG error). Verify
   * during development by checking that `<p-confirmDialog />` exists in
   * either the active route's template or the app-shell.
   */
  ask(opts: ConfirmOptions): Promise<boolean> {
    const severity = opts.severity ?? 'info';
    const isDanger = severity === 'danger';

    return new Promise<boolean>((resolve) => {
      this.primeConfirm.confirm({
        key: opts.key,
        header: opts.header ?? this.defaultHeader(severity),
        message: opts.message,
        icon: opts.icon ?? this.defaultIcon(severity),
        acceptLabel: opts.acceptLabel ?? this.defaultAcceptLabel(severity),
        rejectLabel: opts.rejectLabel ?? 'Cancel',
        acceptButtonStyleClass: this.acceptButtonClass(severity),
        defaultFocus: opts.defaultFocus ?? (isDanger ? 'reject' : 'accept'),
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
  }

  /**
   * Convenience for destructive confirms — pre-binds `severity: 'danger'`
   * and a destructive default header. Equivalent to calling
   * `ask({ severity: 'danger', ... })`.
   */
  askDestructive(opts: Omit<ConfirmOptions, 'severity'>): Promise<boolean> {
    return this.ask({ ...opts, severity: 'danger' });
  }

  private defaultHeader(severity: ConfirmSeverity): string {
    return severity === 'danger' ? 'Confirm destructive action' : 'Confirm';
  }

  private defaultIcon(severity: ConfirmSeverity): string {
    switch (severity) {
      case 'danger':
        return 'pi pi-exclamation-triangle';
      case 'warn':
        return 'pi pi-exclamation-circle';
      case 'success':
        return 'pi pi-check-circle';
      case 'info':
      default:
        return 'pi pi-question-circle';
    }
  }

  private defaultAcceptLabel(severity: ConfirmSeverity): string {
    return severity === 'danger' ? 'Delete' : 'Confirm';
  }

  private acceptButtonClass(severity: ConfirmSeverity): string {
    switch (severity) {
      case 'danger':
        return 'p-button-danger';
      case 'success':
        return 'p-button-success';
      case 'warn':
        return 'p-button-warn';
      case 'info':
      default:
        return '';
    }
  }
}
