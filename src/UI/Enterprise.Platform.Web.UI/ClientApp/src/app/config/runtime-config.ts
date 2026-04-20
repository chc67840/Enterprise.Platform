/**
 * ─── RUNTIME CONFIG — TOKEN + LOADER ────────────────────────────────────────────
 *
 * WHY
 *   Two contracts exposed from one module:
 *
 *     1. `RUNTIME_CONFIG`   — the DI-injected handle to the runtime config.
 *        Every consumer (API token factory, MSAL factory, telemetry, feature-
 *        flag service) injects this token; nobody reads `environment.*` for
 *        runtime-varying data anymore.
 *
 *     2. `loadRuntimeConfig()` — the `provideAppInitializer`-invoked factory
 *        that fetches `/config.json`, validates it against
 *        `RuntimeConfigSchema`, and populates the holder.
 *
 * HOLDER PATTERN
 *   Angular `InjectionToken` factories memoize — first injection locks in the
 *   returned object. We therefore return a **stable holder reference** whose
 *   fields the loader mutates after fetch. Consumers read fields at access
 *   time (e.g. `inject(RUNTIME_CONFIG).apiBaseUrl`), so every read sees the
 *   post-fetch values. The holder pattern avoids needing a signal-typed token
 *   (which would force every consumer to be an injection-context callable)
 *   and keeps the contract a plain POCO.
 *
 * INITIALIZER ORDER
 *   In `app.config.ts` the runtime-config initializer MUST run BEFORE the
 *   MSAL init initializer — MSAL's `PublicClientApplication` factory reads
 *   `clientId` / `tenantId` from this token. `provideAppInitializer` runs
 *   initializers sequentially in registration order, so the ordering is
 *   deterministic once callers register them in the right sequence.
 *
 * FAILURE POLICY
 *   `loadRuntimeConfig()` returns `'fetched' | 'fallback' | 'malformed'`:
 *     - `fetched`: `/config.json` returned 2xx with a schema-valid body.
 *     - `fallback`: `/config.json` was unreachable (network / 404) — the
 *                   build-time `environment.*` fallback is used. Acceptable in
 *                   offline dev, but flagged as a warning in prod logs.
 *     - `malformed`: `/config.json` returned 2xx but the body failed schema
 *                   validation. The loader **throws** — a mis-deployed config
 *                   must be loud, not silent, because the app can't make
 *                   correct auth/API decisions with bad data.
 *
 *   We never let prod continue booting with a malformed config; that would be
 *   strictly worse than the app failing to load.
 */
import { InjectionToken } from '@angular/core';
import type { z } from 'zod';

import { environment } from '@env/environment';

import { RuntimeConfigSchema, type RuntimeConfig } from './runtime-config.model';

/**
 * Build-time fallback used when `/config.json` is unreachable. Derived from
 * `environment.*.ts` so dev / staging / production builds ship a usable
 * default even if the deployment forgets to overwrite `/config.json`.
 *
 * The redirect URI defaults to the current origin at runtime so localhost dev
 * Just Works without editing config files.
 */
function buildFallbackConfig(): RuntimeConfig {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const env = environment;

  return RuntimeConfigSchema.parse({
    apiBaseUrl: env.apiBaseUrl,
    bffBaseUrl: env.bffBaseUrl,
    msal: {
      clientId: env.msal.clientId,
      tenantId: env.msal.tenantId,
      apiScope: env.msal.apiScope,
      redirectUri: env.msal.redirectUri || origin,
      postLogoutRedirectUri: origin ? `${origin}/auth/login` : undefined,
    },
    telemetry: {
      appInsightsConnectionString: '',
      sampleRate: 1,
      webVitalsSampleRate: 0.1,
    },
    session: {
      accessTokenLifetimeSeconds: 900,
      warningLeadTimeSeconds: 120,
      pollIntervalSeconds: 30,
    },
    features: {},
  });
}

/**
 * Stable holder mutated by `loadRuntimeConfig`. Exported for test harnesses
 * that need to reset the holder between cases — **production code must not
 * import this directly**; always go through `RUNTIME_CONFIG`.
 */
export const RUNTIME_CONFIG_HOLDER: RuntimeConfig = buildFallbackConfig();

/**
 * Represents the outcome of a `loadRuntimeConfig` invocation. The test suite
 * asserts on this; the app's logs include it for observability on first boot.
 */
export type RuntimeConfigLoadOutcome = 'fetched' | 'fallback';

/**
 * DI token for the runtime config. Consumers inject this — they never reach
 * for `RUNTIME_CONFIG_HOLDER` or `environment.*` for runtime-varying values.
 *
 * Factory returns the shared holder object by reference so consumer reads
 * (e.g. `inject(RUNTIME_CONFIG).apiBaseUrl`) always see the post-load values.
 */
export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RUNTIME_CONFIG', {
  providedIn: 'root',
  factory: () => RUNTIME_CONFIG_HOLDER,
});

/**
 * Parameters for {@link loadRuntimeConfig}. Split out so the test harness can
 * substitute a fake `fetchImpl` without globalThis patching.
 */
export interface LoadRuntimeConfigOptions {
  /** URL of the runtime config document. Defaults to `/config.json`. */
  readonly url?: string;
  /** `fetch`-compatible implementation. Overridable for tests. */
  readonly fetchImpl?: typeof fetch;
  /**
   * Maximum wait (ms) for the fetch. Prevents a hung request from blocking
   * app bootstrap indefinitely when the hosting origin is partially degraded.
   */
  readonly timeoutMs?: number;
  /**
   * Optional side-channel the caller uses to observe load outcome. Logger /
   * telemetry wiring happens in the caller; this module stays side-effect-free
   * for test ergonomics.
   */
  readonly onOutcome?: (outcome: RuntimeConfigLoadOutcome) => void;
}

/**
 * Fetches `/config.json`, validates via `RuntimeConfigSchema`, and mutates the
 * shared runtime holder. Returns the outcome so the caller can decide how to
 * report it (typically `logger.info` on `fetched`, `logger.warn` on `fallback`).
 *
 * Throws only when the fetch succeeded but the payload failed schema validation
 * — malformed config is a deploy error the app must surface loudly, not a
 * fall-back-to-defaults case.
 */
export async function loadRuntimeConfig(
  options: LoadRuntimeConfigOptions = {},
): Promise<RuntimeConfigLoadOutcome> {
  const url = options.url ?? '/config.json';
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      // `no-cache` defeats browser caching so redeployments don't ship stale
      // config to users with warm tabs; `same-origin` keeps the request scoped
      // to the hosting domain (the runtime config must come from the app's own
      // origin to remain tamper-resistant).
      cache: 'no-cache',
      credentials: 'same-origin',
      signal: controller.signal,
    });
  } catch {
    // Network error, timeout, or aborted. Fall back to build-time defaults.
    clearTimeout(timeout);
    applyFallback();
    options.onOutcome?.('fallback');
    return 'fallback';
  }
  clearTimeout(timeout);

  if (!response.ok) {
    // Hosting origin returned 4xx/5xx. Treated the same as a network fail —
    // the app can still boot in offline-dev mode with build-time defaults.
    applyFallback();
    options.onOutcome?.('fallback');
    return 'fallback';
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    // Body could not be parsed as JSON. This is a loud deploy error.
    throw new Error(
      `Runtime config at "${url}" returned non-JSON body. Fix the deployment artifact.`,
      { cause: err },
    );
  }

  const parsed = RuntimeConfigSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `Runtime config at "${url}" failed schema validation:\n${formatZodError(parsed.error)}`,
    );
  }

  applyConfig(parsed.data);
  options.onOutcome?.('fetched');
  return 'fetched';
}

// ── holder mutation ────────────────────────────────────────────────────────

function applyConfig(next: RuntimeConfig): void {
  // Assign field-by-field so the holder reference stays stable for consumers
  // that cached it. `Object.assign` would also work, but this form makes the
  // deliberate mutation visible to readers of this file.
  RUNTIME_CONFIG_HOLDER.apiBaseUrl = next.apiBaseUrl;
  RUNTIME_CONFIG_HOLDER.bffBaseUrl = next.bffBaseUrl;
  RUNTIME_CONFIG_HOLDER.msal = next.msal;
  RUNTIME_CONFIG_HOLDER.telemetry = next.telemetry;
  RUNTIME_CONFIG_HOLDER.session = next.session;
  RUNTIME_CONFIG_HOLDER.features = next.features;
}

function applyFallback(): void {
  applyConfig(buildFallbackConfig());
}

/**
 * Test-only hook — resets the shared holder to build-time defaults. Never
 * call from production code.
 */
export function __resetRuntimeConfigForTests(): void {
  applyFallback();
}

function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((issue) => `  - ${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('\n');
}
