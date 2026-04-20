# `src/app/config/` — Application configuration

Central place for all cross-cutting providers.

- `app.config.ts` — provider graph (router, HTTP, MSAL, PrimeNG, telemetry)
- `msal.config.ts` — `PublicClientApplication` factory + guard/interceptor configs (Phase 1)
- `primeng.config.ts` — PrimeNG runtime options, CSS layer order, z-index scale (Phase 1)
- `theme.config.ts` — Aura-based PrimeNG theme preset (Phase 5)
- `runtime-config.ts` — `/config.json` loader + `RUNTIME_CONFIG` token (Phase 2.1)

**Import rules:**
- Config may import from anywhere (it's the composition root).
- Nothing but `main.ts` should import from config.
