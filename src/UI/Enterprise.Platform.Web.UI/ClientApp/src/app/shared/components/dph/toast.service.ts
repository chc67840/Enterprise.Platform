/**
 * ─── DPH UI KIT — TOAST SERVICE ─────────────────────────────────────────────────
 *
 * Single funnel for all toast notifications. Wraps PrimeNG `MessageService`
 * so feature code never imports `MessageService` directly. Standardizes:
 *   - default `life` per severity (errors stay longer than successes)
 *   - severity → ARIA live region mapping (alert/status)
 *   - icon defaults per severity
 *
 * The global `<p-toast>` lives in AppShellComponent. Position is `top-right`
 * on desktop and switches via PrimeNG's responsive options.
 */
import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

import type { MessageDescriptor, Severity } from './dph.types';

const DEFAULT_LIFE_MS: Record<Severity, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  danger: 6000,
  neutral: 4000,
};

const SEVERITY_ICONS: Record<Severity, string> = {
  success: 'pi pi-check-circle',
  info: 'pi pi-info-circle',
  warning: 'pi pi-exclamation-triangle',
  danger: 'pi pi-times-circle',
  neutral: 'pi pi-bell',
};

const PRIMENG_SEVERITY: Record<Severity, string> = {
  success: 'success',
  info: 'info',
  warning: 'warn',
  danger: 'error',
  neutral: 'secondary',
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly msg = inject(MessageService);

  /** Convenience — green check + 3.5s life. */
  success(summary: string, detail?: string, life?: number): void {
    this.show({ severity: 'success', summary, detail, life });
  }

  /** Convenience — red X + 6s life (sticky-ish, errors should be readable). */
  error(summary: string, detail?: string, life?: number): void {
    this.show({ severity: 'danger', summary, detail, life });
  }

  /** Convenience — amber triangle + 5s life. */
  warning(summary: string, detail?: string, life?: number): void {
    this.show({ severity: 'warning', summary, detail, life });
  }

  /** Convenience — blue info + 4s life. */
  info(summary: string, detail?: string, life?: number): void {
    this.show({ severity: 'info', summary, detail, life });
  }

  /** Custom — pass the full descriptor when defaults don't fit. */
  show(message: MessageDescriptor): void {
    const life = message.sticky ? 0 : (message.life ?? DEFAULT_LIFE_MS[message.severity]);
    this.msg.add({
      key: message.id,
      severity: PRIMENG_SEVERITY[message.severity],
      summary: message.summary,
      detail: message.detail,
      life,
      sticky: message.sticky ?? false,
      closable: message.closable ?? true,
      icon: message.icon ?? SEVERITY_ICONS[message.severity],
    });
  }

  /** Clears the global toast queue, or a single keyed toast when `key` is provided. */
  clear(key?: string): void {
    this.msg.clear(key);
  }
}
