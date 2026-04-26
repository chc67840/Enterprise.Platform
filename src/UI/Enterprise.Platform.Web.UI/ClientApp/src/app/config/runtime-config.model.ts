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
export type SessionRuntimeConfig = z.infer<typeof SessionRuntimeConfigSchema>;
