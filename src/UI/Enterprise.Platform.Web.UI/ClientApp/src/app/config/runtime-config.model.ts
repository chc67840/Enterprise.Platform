/**
 * ─── RUNTIME CONFIGURATION MODEL ─────────────────────────────────────────────────
 *
 * WHY
 *   `environment.*.ts` is baked at build time. Anything that needs to vary per
 *   deployment — API endpoint, telemetry sink, feature flags — lives in
 *   `/config.json` fetched during app bootstrap so container / K8s /
 *   static-host deployments can point the same artefact at different backends
 *   without a rebuild.
 *
 *   Post-Phase-9 note: Entra client/tenant IDs no longer live here. Auth is
 *   BFF-mediated — the SPA never needs OIDC identifiers because it never
 *   talks to Entra directly. Those IDs moved to the BFF's `appsettings.*.json`
 *   under the `AzureAd` section.
 *
 * LAYERING (reference UI-Architecture §2.2)
 *   - `environment.*.ts`    → build-time invariants (production flag, feature
 *                              gates that never change, offline-dev fallbacks).
 *   - `/config.json`         → deployment-scoped runtime values (this file's shape).
 *   - `localStorage: prefs`  → per-user preferences (theme, locale, etc.).
 *
 * SECURITY INVARIANT
 *   `/config.json` is served as a plain static asset and therefore MUST NEVER
 *   contain secrets. Anything with entropy (keys, passwords, signing material)
 *   is disallowed. Eslint `no-secrets` + the pre-commit secrets scanner
 *   enforce this at commit time; this module validates shape at load time.
 *
 * VALIDATION
 *   The Zod schema below is the single source of truth for the runtime-config
 *   shape. `loadRuntimeConfig()` runs the schema so malformed / tampered
 *   `/config.json` payloads surface a typed error at boot rather than silent
 *   undefined-propagation during feature execution.
 */
import { z } from 'zod';

/**
 * Telemetry sink configuration. Phase 3.1 consumes these via
 * `TelemetryService.init()`. The connection-string shape follows the modern
 * Application Insights format (preferred over legacy instrumentation key).
 *
 * Two independent sample rates:
 *   - `sampleRate` gates every telemetry event (pageView, trackEvent,
 *     trackError). Default 1 (100%) — errors are rare and always valuable;
 *     Phase 7 may drop to 0.25 in prod if noise justifies it.
 *   - `webVitalsSampleRate` gates LCP/INP/CLS/FCP/TTFB metrics specifically.
 *     Default 0.1 (10% of sessions) per TODO 3.3.2 — vitals are high-volume
 *     and dashboards stay meaningful at 10% while costs stay bounded.
 */
export const TelemetryRuntimeConfigSchema = z.object({
  appInsightsConnectionString: z.string().trim(),
  /** Global sampling ratio for events / errors / page views. 0 = off, 1 = always. */
  sampleRate: z.number().min(0).max(1).default(1),
  /** Sampling ratio for web-vitals metrics only. Overrides `sampleRate` for vitals. */
  webVitalsSampleRate: z.number().min(0).max(1).default(0.1),
});

/**
 * Session-expiry UX configuration. Post-Phase-9 the BFF owns the actual token
 * refresh; these values tune the client-side warning dialog cadence.
 */
export const SessionRuntimeConfigSchema = z.object({
  /** Access-token lifetime hint. Informational — the BFF's refresh hook controls the real window. */
  accessTokenLifetimeSeconds: z.number().int().positive().default(900),
  /** Seconds-before-expiry at which the warning dialog opens. */
  warningLeadTimeSeconds: z.number().int().positive().default(120),
  /** Seconds between `/api/auth/session` polls. Poll interval should divide lead time. */
  pollIntervalSeconds: z.number().int().positive().default(30),
});

/**
 * The top-level runtime config. Optional fields MUST default to safe-but-off
 * values so the app still boots in genuinely-offline dev sessions.
 */
export const RuntimeConfigSchema = z.object({
  apiBaseUrl: z.string().trim().min(1, 'apiBaseUrl must be a non-empty URL.'),
  bffBaseUrl: z.string().trim().default(''),
  telemetry: TelemetryRuntimeConfigSchema.default({
    appInsightsConnectionString: '',
    sampleRate: 1,
    webVitalsSampleRate: 0.1,
  }),
  session: SessionRuntimeConfigSchema.default({
    accessTokenLifetimeSeconds: 900,
    warningLeadTimeSeconds: 120,
    pollIntervalSeconds: 30,
  }),
  /**
   * Runtime feature flags. Overrides `environment.features` for flags that can
   * toggle without a rebuild. Keys use `feature.subfeature` dot-notation to
   * keep the shape flat; Phase 2.2 `FeatureFlagService` reads this map.
   */
  features: z.record(z.string(), z.boolean()).default({}),
});

/** Strongly-typed projection of the Zod schema. */
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;
export type TelemetryRuntimeConfig = z.infer<typeof TelemetryRuntimeConfigSchema>;
export type SessionRuntimeConfig = z.infer<typeof SessionRuntimeConfigSchema>;
