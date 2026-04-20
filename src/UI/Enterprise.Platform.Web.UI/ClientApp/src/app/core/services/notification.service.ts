/**
 * ─── NOTIFICATION SERVICE ───────────────────────────────────────────────────────
 *
 * WHY
 *   A thin, semantic wrapper over PrimeNG's `MessageService` so the rest of the
 *   app calls `notification.success(...)` / `.error(...)` instead of repeating
 *   the PrimeNG severity strings everywhere. Benefits:
 *
 *     1. One place to tune defaults (life, sticky, icon, key).
 *     2. Swap the underlying library later without touching call sites.
 *     3. Lint-enforced policy: HTTP-error toasts are owned by `errorInterceptor`;
 *        stores only emit business/UX toasts via this service, never raw
 *        `MessageService` (ESLint rule lands in Phase 1.6).
 *
 * HOW IT'S USED
 *   ```ts
 *   private readonly notify = inject(NotificationService);
 *
 *   this.notify.success('User created', 'Alice was added successfully.');
 *   this.notify.error('Export failed', 'Please retry in a moment.');
 *   this.notify.info('Autosaved', 'Your changes are safe.');
 *   this.notify.warn('Unsaved changes', 'Your form has unsaved edits.');
 *   ```
 *
 * WIRING
 *   `MessageService` is provided at app root via `providePrimeNG()` + the
 *   explicit `MessageService` entry in `app.config.ts`. `<p-toast>` is mounted
 *   once inside `AppShellComponent`; every notification in the app flows
 *   through that single host.
 *
 * POLICY (Architecture §4.3)
 *   - `errorInterceptor` is the ONLY place HTTP-error toasts originate from.
 *     Feature stores must not call `notify.error(...)` on an HTTP failure —
 *     instead capture into their `error()` signal for inline display.
 *   - Success toasts belong to the store that performed the write (create /
 *     update / delete).
 *   - `info` and `warn` are free-form for feature use.
 */
import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

/** Default toast lifetime in milliseconds. Override per-call if the message is longer / shorter. */
const DEFAULT_LIFE_MS = 4000;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messages = inject(MessageService);

  /** Success toast — green, dismisses in 4s unless overridden. */
  success(summary: string, detail?: string, lifeMs: number = DEFAULT_LIFE_MS): void {
    this.messages.add({ severity: 'success', summary, detail, life: lifeMs });
  }

  /**
   * Error toast — red.
   *
   * Reminder: HTTP-error toasts are owned by `errorInterceptor`. Call this
   * from a store only for non-HTTP failures (e.g. client-side validation
   * errors, failed local operations).
   */
  error(summary: string, detail?: string, lifeMs: number = DEFAULT_LIFE_MS): void {
    this.messages.add({ severity: 'error', summary, detail, life: lifeMs });
  }

  /** Warn toast — amber. Use for reversible anomalies the user should know about. */
  warn(summary: string, detail?: string, lifeMs: number = DEFAULT_LIFE_MS): void {
    this.messages.add({ severity: 'warn', summary, detail, life: lifeMs });
  }

  /** Info toast — blue. Use for neutral confirmations ("autosaved", "copied"). */
  info(summary: string, detail?: string, lifeMs: number = DEFAULT_LIFE_MS): void {
    this.messages.add({ severity: 'info', summary, detail, life: lifeMs });
  }

  /**
   * Sticky toast — does not auto-dismiss. Use sparingly, typically for actions
   * requiring user acknowledgement (e.g. "session expired, please sign in").
   */
  sticky(severity: 'success' | 'info' | 'warn' | 'error', summary: string, detail?: string): void {
    this.messages.add({ severity, summary, detail, sticky: true });
  }

  /** Clears all toasts. Rarely needed — most toasts should auto-dismiss. */
  clear(): void {
    this.messages.clear();
  }
}
