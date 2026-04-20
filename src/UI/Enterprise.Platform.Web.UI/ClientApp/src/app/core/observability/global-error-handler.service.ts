/**
 * ─── GLOBAL ERROR HANDLER ───────────────────────────────────────────────────────
 *
 * WHY
 *   Replaces Angular's default `ErrorHandler` so every uncaught error in the
 *   SPA:
 *
 *     1. Lands in telemetry with correlation id + user id + current route.
 *     2. Shows a user-friendly toast (unless it's an `HttpErrorResponse`,
 *        which is owned by `errorInterceptor`).
 *     3. Navigates to `/error/server-error` on fatal classes (chunk-load
 *        failures, router navigation errors) where the UI can't realistically
 *        continue.
 *
 *   Ownership policy (Architecture §4.3):
 *     errorInterceptor  → HTTP failures (toasts + /error/forbidden on 403, etc.)
 *     GlobalErrorHandler → everything else (unhandled promise rejections,
 *                           component render errors, async iterator blow-ups)
 *
 * CHUNK-LOAD FAILURES
 *   When the router navigates to a lazy-loaded route whose chunk 404s (stale
 *   client after deploy, transient network), Angular throws an error with
 *   `ChunkLoadError` or a message starting with "Loading chunk". These are
 *   recoverable by forcing a full reload, but we land the user on
 *   `/error/server-error` first so they see a clear message + retry button.
 *
 * CONSOLE BEHAVIOUR
 *   In production we keep console output minimal (LoggerService.error writes
 *   structured payloads already). In development we let the error reach the
 *   console so the familiar stack trace shows up in devtools.
 */
import { Injectable, inject, type ErrorHandler } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '@env/environment';
import { LoggerService } from '@core/services/logger.service';
import { NotificationService } from '@core/services/notification.service';

import { TelemetryService } from './telemetry.service';

/** Heuristics for "fatal — can't continue rendering" errors. */
function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'ChunkLoadError') return true;
  return /loading\s*chunk\s*[\w-]+\s*failed/i.test(err.message);
}

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandlerService implements ErrorHandler {
  private readonly telemetry = inject(TelemetryService);
  private readonly notify = inject(NotificationService);
  private readonly log = inject(LoggerService);
  private readonly router = inject(Router);

  handleError(error: unknown): void {
    // HTTP errors have a dedicated owner; silence here to avoid double toasts.
    if (error instanceof HttpErrorResponse) {
      return;
    }

    // Unwrap the common `rxjs` EmptyError / zone wrappers so the stored error
    // carries the meaningful class name.
    const unwrapped = this.unwrap(error);

    // Fatal-class detection → hard navigation to the server-error page. Chunk
    // load failures almost always mean the user's cached bundle references a
    // stale deploy; a manual reload from the /error page unblocks them.
    if (isChunkLoadError(unwrapped)) {
      this.log.error('error.chunk.load.failed', { error: unwrapped });
      this.telemetry.trackError(unwrapped, { category: 'chunk-load' });
      this.telemetry.flush();
      void this.router.navigate(['/error/server-error']);
      return;
    }

    // Best-effort log + telemetry; toast the user with a generic message so
    // they know *something* went wrong without leaking technical detail.
    this.log.error('error.unhandled', { error: unwrapped });
    this.telemetry.trackError(unwrapped, { category: 'unhandled' });
    this.notify.error(
      'Something went wrong',
      'An unexpected error occurred. Please try again.',
    );

    // Dev builds: let the familiar stack reach the browser console too.
    if (!environment.production) {
      // eslint-disable-next-line no-console -- dev-only fallback for stack trace
      console.error(unwrapped);
    }
  }

  /**
   * RxJS + Zone.js sometimes wrap the real error inside `{ rejection: ... }`
   * or `{ originalError: ... }`. Unwrap one level so the exception class
   * stays meaningful in App Insights.
   */
  private unwrap(err: unknown): unknown {
    if (err && typeof err === 'object') {
      const rec = err as Record<string, unknown>;
      if ('rejection' in rec && rec['rejection']) return rec['rejection'];
      if ('originalError' in rec && rec['originalError']) return rec['originalError'];
    }
    return err;
  }
}
