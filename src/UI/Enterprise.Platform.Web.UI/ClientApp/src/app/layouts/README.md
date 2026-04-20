# `src/app/layouts/` — Outer chromes

Application-level layout shells that wrap route trees.

- `app-shell/` — Authed layout: sidebar + header + toast host + confirm host + router outlet (Phase 1)
- `auth-layout/` — Public layout for `/auth/*` (Phase 1)
- `error-layout/` — Lightweight wrapper for `/error/*` pages (Phase 1.2)

**Import rules:**
- Layouts may import from `@core/*` and `@shared/*`.
- Layouts MUST NOT import from `@features/*` — features mount inside the router
  outlet, never via direct component imports.
