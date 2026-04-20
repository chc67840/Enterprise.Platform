# `src/app/features/` — Feature vertical slices

Each folder is a self-contained vertical slice owning its models, API service,
store, components, and routes for a single aggregate / domain concept.

**Slice shape** (target — schematic lands in Phase 11.1):

```
features/<name>/
├── models/<name>.model.ts              # Entity interface extending BaseEntity
├── services/<name>-api.service.ts      # extends BaseApiService<T>
├── store/<name>.store.ts               # createEntityStore<T>
├── components/
│   ├── <name>-list/<name>-list.component.ts
│   ├── <name>-detail/<name>-detail.component.ts
│   └── <name>-form/<name>-form.component.ts
├── <name>.routes.ts                    # lazy-loaded child routes
└── index.ts                            # barrel
```

**Import rules:**
- Features may import from `@core/*`, `@shared/*`, `@layouts/*`.
- Features MUST NOT import from sibling features directly. Cross-feature
  coordination goes through `core/store/cache-invalidation.bus.ts` (Phase 6.3)
  or via the router.
