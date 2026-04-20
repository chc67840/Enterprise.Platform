# `src/app/core/` — Core tier

Non-feature singletons. Owns:

- `auth/` — MSAL wrapping + `AuthService`/`AuthStore` signals (Phase 1)
- `guards/` — `authGuard`, `permissionGuard`, `roleGuard`, `ownershipGuard`, `unsavedChangesGuard` (Phase 1)
- `http/` — `BaseApiService<T>` + `API_BASE_URL` token (Phase 1)
- `interceptors/` — correlation / tenant / security / cache / dedup / loading / logging / retry / error (Phase 1–6)
- `models/` — API contracts, entity models, route metadata types (Phase 1)
- `services/` — cross-cutting services (logger, telemetry, feature-flag, loading, notification, theme, layout, locale, tenant) (Phases 1–8)
- `store/base/` — `createEntityStore` factory + `with-*` features + cache invalidation bus (Phase 1+6)

**Import rules:**
- Core may import from `@shared/*` **types only** (no components / services).
- Core may NOT import from `@features/*` or `@layouts/*`.
- Enforced by ESLint `import/no-restricted-paths` — Phase 1.6.
