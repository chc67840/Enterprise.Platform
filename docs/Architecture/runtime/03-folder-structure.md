# 03 — Feature Folder Structure

The canonical layout for any feature. Copy this skeleton when adding a new one.

```
src/app/features/<feature-name>/
├── data/
│   ├── <entity>.types.ts            ← REQUIRED — TypeScript interfaces for DTOs + requests
│   ├── <entity>.schemas.ts          ← REQUIRED — Zod schemas mirroring the types
│   ├── <feature>-api.service.ts     ← REQUIRED — HttpClient wrapper, exactly one per feature
│   └── <feature>-api.service.spec.ts ← REQUIRED — HTTP boundary spec (HttpTestingController)
├── state/
│   ├── <feature>.store.ts           ← REQUIRED if the feature has any cross-component state
│   └── <feature>.store.spec.ts      ← REQUIRED with the store
├── views/
│   ├── <feature>-list.component.ts        ← OPTIONAL — list/grid page
│   ├── <feature>-detail.component.ts      ← OPTIONAL — single-record page
│   ├── <feature>-create.component.ts      ← OPTIONAL — new-record form page
│   ├── <feature>-edit.component.ts        ← OPTIONAL — edit-record form page (often skipped — detail page handles inline edit)
│   └── *.spec.ts                          ← REQUIRED smoke spec per view
└── <feature>.routes.ts                    ← REQUIRED — exports `XYZ_ROUTES: Routes`
```

## Rules

### REQUIRED — every feature has these

| File | Why |
|---|---|
| `data/<entity>.types.ts` | TypeScript shapes for what the backend returns/accepts. No business logic. |
| `data/<entity>.schemas.ts` | Zod runtime validation at the API boundary. See `04`. |
| `data/<feature>-api.service.ts` | The ONE place HTTP calls live for this feature. See `04`. |
| `<feature>.routes.ts` | Lazy route block. See `07`. |

### REQUIRED if the feature has state

| File | Why |
|---|---|
| `state/<feature>.store.ts` | NGRX SignalStore provided at the route level. See `05`. |

A feature without cross-component state (e.g. a single static landing page) skips `state/` entirely.

### OPTIONAL

| File | When |
|---|---|
| Multiple stores under `state/` | Only when the feature genuinely has independent state slices (e.g. `users.store.ts` + `users-permissions.store.ts`). Default to ONE. |
| `views/<x>-create.component.ts` | If you have a dedicated "new" route. Otherwise, an inline form on the list page is fine. |
| Helper services under `services/` | Only when the feature has logic that doesn't fit in the api service or the store (rare — most belongs in the store). Don't create the folder speculatively. |

### NOT in the feature folder

These belong elsewhere — keep features narrow:

| What | Where |
|---|---|
| Shared utility functions | `src/app/shared/utils/*` (see `Architecture/UI-Standards-Triage.md`) |
| Shared constants | `src/app/shared/constants/*` |
| Shared UI components (table, button, badge, empty-state) | `src/app/shared/components/*` |
| Auth guards | `src/app/core/guards/*` (already exist; reuse) |
| HTTP interceptors | `src/app/core/interceptors/*` (already exist; reuse) |
| Layout / chrome (navbar, footer, banners) | `src/app/shared/layout/*` |

## Naming conventions

- **Folder name** matches the route path. `/users` → `features/users/`. `/admin/audit-log` → `features/admin/audit-log/`.
- **File suffixes** declare the role:
  - `.types.ts` — TypeScript types only
  - `.schemas.ts` — Zod schemas only
  - `.store.ts` — signalStore declaration
  - `.component.ts` — Angular component
  - `.service.ts` — Injectable service (api or otherwise)
  - `.spec.ts` — Vitest spec for the same-named source file
  - `.routes.ts` — `Routes` export
- **Class names** are PascalCase + the file's role: `UsersListComponent`, `UsersStore`, `UsersApiService`.
- **Constant exports** are SCREAMING_SNAKE_CASE: `DEFAULT_LIST_PARAMS`, `USERS_ROUTES`.

## Why no `index.ts` barrel inside features?

Features are reached only through their `routes.ts`. The router handles the lazy import. **No other code in the app should import from a feature folder** — features are leaves of the dependency graph, not nodes.

A barrel would suggest "import this feature's pieces from elsewhere," which is the wrong shape. If you find yourself wanting to import `UsersStore` from outside the Users feature, that's a smell:
- If it's another feature → that feature should make its own API call, not borrow Users' store
- If it's a layout (navbar, etc.) → the layout shouldn't depend on a feature; the feature should push data to a shared store

## When a feature gets too big

Threshold of pain: a single feature folder hits ~30 files OR a single file hits ~500 lines.

- **Split into sub-features** by sub-route. `features/users/` with `views/groups/`, `views/permissions/`, `views/audit/` → split to `features/users/`, `features/user-groups/`, `features/user-permissions/`, `features/user-audit/` — each with its own routes file mounted under the same parent route.
- **Extract a sub-component** to its own file when a `<app-x-y>` selector appears more than 3x or its template exceeds ~80 lines.

## What this NEVER becomes

- **Per-feature folders for `models/`, `services/`, `pipes/`, `directives/`, `guards/`** — these create churn without benefit. Models go in `data/`, services in `data/`, pipes/directives that are feature-specific live next to the component that uses them. Anything cross-cutting goes in `shared/`.
- **`README.md` per feature** — code is the documentation. The doc you're reading IS the per-feature architecture.
- **A `public-api.ts` exposing a feature's surface** — features have no public API; they're consumed through routes only.

## Checklist when adding a new feature

```
□ Folder created at src/app/features/<name>/
□ data/<entity>.types.ts — interfaces for DTOs
□ data/<entity>.schemas.ts — matching Zod schemas
□ data/<feature>-api.service.ts — HttpClient wrapper, no error handling
□ data/<feature>-api.service.spec.ts — HTTP boundary spec
□ state/<feature>.store.ts — if cross-component state exists
□ state/<feature>.store.spec.ts — if a store was created
□ views/<feature>-list.component.ts — list view if applicable
□ views/<feature>-list.component.spec.ts — smoke spec
□ <feature>.routes.ts — lazy route exports XYZ_ROUTES
□ app.routes.ts — added a 'feature-name' lazy route block under the shell
□ Backend endpoints exist + match the api service
□ Run ng build → green
□ Run vitest → green
```
