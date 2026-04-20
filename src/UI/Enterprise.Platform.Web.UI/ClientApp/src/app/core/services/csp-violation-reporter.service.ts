/**
 * ─── CSP VIOLATION REPORTER ─────────────────────────────────────────────────────
 *
 * WHY
 *   Browsers dispatch a `securitypolicyviolation` DOM event whenever a CSP
 *   directive blocks a resource. Catching this in JS lets us:
 *
 *     1. Log violations client-side so developers see them in telemetry
 *        instead of having to read browser dev-tools consoles from users'
 *        machines.
 *     2. Correlate violations with the current correlation id so a violation
 *        (e.g. blocked external script) ties back to the specific user
 *        session / route / action.
 *     3. Scrub PII out of `blockedURI` / `sourceFile` (query strings can
 *        carry emails, tokens, etc.) via `LoggerService.scrub`.
 *
 * INIT CONTRACT
 *   `register()` is invoked from `provideAppInitializer` in `app.config.ts` so
 *   the listener is wired before the first render. Returning a void promise
 *   lets it sit in a chain with other initializers.
 *
 *   The service holds a single `DestroyRef` subscription to remove the
 *   listener on app teardown — important for Vitest + TestBed harnesses that
 *   repeatedly init/destroy the app.
 *
 * WHAT WE DON'T DO HERE
 *   This service only captures and logs. Forwarding to a backend `report-uri`
 *   endpoint lands alongside the BFF nonce-based policy in Phase 9 — today's
 *   deployment is static-host, so the browser itself can't POST to a
 *   `report-uri` of another origin without the server setting `Report-To`
 *   headers. Telemetry forwarding happens through `LoggerService` which is
 *   upgraded to forward via Application Insights in Phase 3.1.
 */
import { DestroyRef, Injectable, inject } from '@angular/core';

import { LoggerService } from './logger.service';

@Injectable({ providedIn: 'root' })
export class CspViolationReporterService {
  private readonly log = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);
  private registered = false;

  /**
   * Subscribes to `securitypolicyviolation`. Idempotent — multiple calls are
   * a no-op so the app-initializer can invoke us once without guarding.
   */
  register(): void {
    if (this.registered) {
      return;
    }
    if (typeof document === 'undefined') {
      // Defensive — SSR or test environments without a DOM.
      return;
    }

    const listener = (event: SecurityPolicyViolationEvent): void => this.handle(event);
    document.addEventListener('securitypolicyviolation', listener);

    this.destroyRef.onDestroy(() =>
      document.removeEventListener('securitypolicyviolation', listener),
    );
    this.registered = true;
  }

  /**
   * Projects the event into a structured log record. `blockedURI` /
   * `sourceFile` / `sample` are the most useful fields for triage:
   *
   *   - `blockedURI`    — what the browser refused to load.
   *   - `sourceFile`    — which script/style introduced the violation.
   *   - `sample`        — up to 40 chars of the offending content (only if
   *                        the policy uses `report-sample`).
   *   - `violatedDirective` — which directive fired (`script-src`, `style-src` …).
   */
  private handle(event: SecurityPolicyViolationEvent): void {
    this.log.warn('csp.violation', {
      violatedDirective: event.violatedDirective,
      effectiveDirective: event.effectiveDirective,
      blockedURI: event.blockedURI,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
      columnNumber: event.columnNumber,
      documentURI: event.documentURI,
      sample: event.sample,
      disposition: event.disposition,
    });
  }
}
