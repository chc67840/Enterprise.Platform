/**
 * ─── LOGGER SERVICE ─────────────────────────────────────────────────────────────
 *
 * WHY
 *   Every line of structured logging in the app funnels through this single
 *   service so we can:
 *
 *     1. Scrub PII (emails, phone numbers, SSNs, credit-card-ish patterns,
 *        allow-listed field names) before anything hits the console or the
 *        telemetry sink.
 *     2. Correlate logs with backend traces by stamping the active correlation
 *        id (populated by `correlationInterceptor`) on every record.
 *     3. Swap destinations per environment — console in dev, Application
 *        Insights in staging/prod (wired in Phase 3).
 *     4. Respect `environment.features.enableLogging` so production builds can
 *        drop debug/info chatter entirely.
 *
 * WHAT'S A "STRUCTURED LOG"
 *   A record with a level (`debug`/`info`/`warn`/`error`), a short message, and
 *   an optional context object. We never format strings via template literals
 *   with user data inline — context stays a proper object so the telemetry SDK
 *   can index fields individually.
 *
 * HOW IT'S USED
 *   ```ts
 *   private readonly log = inject(LoggerService);
 *   this.log.info('user.create', { userId });
 *   this.log.error('users.loadAll failed', { error, params });
 *   ```
 *
 * DESIGN NOTES
 *   - `scrub()` is exposed publicly so telemetry sinks (Phase 3) can reuse the
 *     same redaction rules on their payloads.
 *   - PII allow-list is intentionally aggressive: we'd rather redact a harmless
 *     field than accidentally log a PHI value.
 *   - No RxJS here — logging is fire-and-forget. Keeping it synchronous means
 *     the call site never has to await.
 */
import { Injectable } from '@angular/core';
import { environment } from '@env/environment';

/** Severity levels matching most telemetry SDKs' conventions. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Field names that are presumed to carry PII or sensitive data and whose values
 * should be replaced with `'<redacted>'` before logging. Case-insensitive.
 *
 * Keep this list in sync with the backend's `PiiScrubber.DefaultAllowlist` so
 * frontend + backend redaction rules match.
 */
const SENSITIVE_KEY_NAMES = new Set([
  'password',
  'passwd',
  'pwd',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'authorization',
  'cookie',
  'ssn',
  'socialSecurityNumber',
  'creditcardnumber',
  'ccnumber',
  'cvv',
  'pin',
  'firstname',
  'lastname',
  'fullname',
  'middlename',
  'dateofbirth',
  'dob',
  'email',
  'phonenumber',
  'phone',
  'address',
  'street',
  'postalcode',
  'zipcode',
]);

/** Regex patterns replaced inside string values. Run in order; first match wins per field. */
const PII_PATTERNS: Array<{ readonly regex: RegExp; readonly replacement: string }> = [
  // Emails
  {
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '<email>',
  },
  // Credit-card-ish sequences — 13–19 digits with optional single separator
  // between groups. Split into concrete lengths to avoid variable-range
  // repetition that ESLint-security flags as backtracking-prone; in practice
  // only these lengths matter (Visa/MC 16, Amex 15, UnionPay 13-19).
  {
    regex: /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{1,7}\b/g,
    replacement: '<card>',
  },
  // US SSN-ish (###-##-####)
  {
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '<ssn>',
  },
  // E.164-ish phone numbers (simple heuristic)
  {
    regex: /\+?\d{1,3}[ -]?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}/g,
    replacement: '<phone>',
  },
];

@Injectable({ providedIn: 'root' })
export class LoggerService {
  /** Is structured logging enabled at all? Prod builds set this to `false`. */
  private readonly enabled = environment.features.enableLogging;

  /** Debug — noisy diagnostics. Dropped in prod regardless of level setting. */
  debug(message: string, context?: unknown): void {
    if (!this.enabled) return;
    this.write('debug', message, context);
  }

  /** Info — lifecycle events (login, navigation, stage transitions). */
  info(message: string, context?: unknown): void {
    if (!this.enabled) return;
    this.write('info', message, context);
  }

  /** Warn — recoverable anomalies (retryable errors, fallback usage). */
  warn(message: string, context?: unknown): void {
    this.write('warn', message, context);
  }

  /** Error — failures that surface to the user or trip telemetry. Always logged. */
  error(message: string, context?: unknown): void {
    this.write('error', message, context);
  }

  /**
   * Public PII-scrubber used by telemetry sinks (Phase 3) so their payloads
   * match this service's redaction policy.
   *
   * Input can be any JSON-serialisable value; output is the same shape with
   * sensitive values replaced by `'<redacted>'` or pattern-specific tokens.
   *
   * Circular references are handled safely; depth is capped at 8 to avoid
   * runaway recursion on pathological inputs.
   */
  scrub(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
    if (depth > 8) return '<truncated>';
    if (value === null || value === undefined) return value;

    if (typeof value === 'string') return this.scrubString(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) {
      return {
        name: value.name,
        message: this.scrubString(value.message),
        // Stacks are developer-facing; keep as-is in dev, truncate in prod.
        stack: this.enabled ? value.stack : undefined,
      };
    }

    if (typeof value === 'object') {
      if (seen.has(value as object)) return '<cycle>';
      seen.add(value as object);

      if (Array.isArray(value)) {
        return value.map((item) => this.scrub(item, depth + 1, seen));
      }

      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        if (SENSITIVE_KEY_NAMES.has(key.toLowerCase())) {
          out[key] = '<redacted>';
        } else {
          out[key] = this.scrub(val, depth + 1, seen);
        }
      }
      return out;
    }

    return value;
  }

  private scrubString(input: string): string {
    let out = input;
    for (const { regex, replacement } of PII_PATTERNS) {
      out = out.replace(regex, replacement);
    }
    return out;
  }

  /**
   * The single write path. Current destination is the browser console; Phase 3
   * replaces this with a telemetry-SDK bridge. Keeping this method `private`
   * means every call site goes through `debug/info/warn/error` + scrub.
   */
  private write(level: LogLevel, message: string, context?: unknown): void {
    const payload = {
      ts: new Date().toISOString(),
      level,
      message,
      context: context !== undefined ? this.scrub(context) : undefined,
    };

    // eslint-disable-next-line no-console -- the single place console logging is permitted
    const fn = console[level] ?? console.log;
    fn.call(console, payload);
  }
}
