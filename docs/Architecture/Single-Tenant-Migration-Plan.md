# Single-Tenant Migration Plan

**Status:** 🟡 Awaiting approval to execute. No code touched yet.
**Authored:** 2026-04-25.
**Companion:** [`Architecture-Standards-Audit.md`](./Architecture-Standards-Audit.md) (drives Phase 2).

---

## 0 · Decisions on record

| Decision | Resolution |
|---|---|
| Tenancy model | **Pure single-tenant strip-out.** No `tenancyMode` flag. Future multi-tenant = deliberate v2 with proper tooling. |
| BaseEntity refactor | **Partial-class extension.** Sister files declare `partial class X : AuditableEntity` (or BaseEntity). Survives EF scaffolds. |
| Context name | **`AppDbContext`** in `Infrastructure/Persistence/App/Contexts/`. Namespace `Enterprise.Platform.Infrastructure.Persistence.App`. DI extension `AddAppDb(...)`. |
| Connection string | **`ConnectionStrings:AppDb`**, new database `EnterprisePlatform`. EF migrations create from scratch. |
| Domain (EventShopper) | **Rip all 30+ entities, all DTOs, all endpoints, all features.** Start `AppDbContext` with zero entities. New entities will be added properly with BaseEntity inheritance. |
| Review scope | Backend + frontend, **phased**: Phase 1 (this plan) → Phase 2 (audit findings) → Phase 3 (UI cleanup polish). |
| Existing data | **None.** Greenfield DB created from migrations. |

---

## 1 · Executive summary

| Concern | Files DELETE | Files EDIT | Files RENAME | Net |
|---|---|---|---|---|
| Backend tenancy strip | 13 | 18 | 0 | 31 |
| Backend EventShopper rip | 50+ | 8 | 4 | 62 |
| Frontend tenancy strip | 3 | 11 | 0 | 14 |
| Connection string + appsettings | 0 | 4 | 0 | 4 |
| New AppDbContext setup | 0 | 0 | 0 (replaces in-place) | 0 |
| **Total** | **~66** | **~41** | **4** | **~111** |

**Risk:** medium-high. Coordinated changes across Domain/Application/Infrastructure/API/Worker/UI. The 8-commit ordering below keeps the project green at every checkpoint except commit 6 (entity wipe — temporarily breaks build until commit 7 resolves orphans).

**Total estimated execution time** (with verification at every step): 60–90 minutes if no surprises.

---

## 2 · Backend — tenancy strip

### 2.1 Files to DELETE (13)

| Path | Why |
|---|---|
| `API/.../Middleware/TenantResolutionMiddleware.cs` | Entire file is tenant-resolution; goes away |
| `Contracts/.../Settings/MultiTenancySettings.cs` | POCO + isolation-mode enums |
| `Contracts/.../Enumerations/TenantIsolationMode.cs` | Shared/Schema/Database enum (in Contracts.Shared) |
| `Core/Domain/Exceptions/TenantMismatchException.cs` | Unused after strip |
| `Core/Domain/Interfaces/ICurrentTenantService.cs` | Tenant-resolution contract |
| `Core/Domain/Interfaces/ITenantEntity.cs` | Marker interface |
| `Core/Domain/Entities/TenantAuditableEntity.cs` | Replaced by `AuditableEntity` |
| `Infrastructure/Identity/Services/CurrentTenantService.cs` | Implementation of tenant resolver |
| `Infrastructure/MultiTenancy/ITenantIsolationStrategy.cs` | Strategy abstraction |
| `Infrastructure/MultiTenancy/SharedDatabaseTenantStrategy.cs` | Active strategy |
| `Infrastructure/MultiTenancy/TenantDatabaseStrategy.cs` | Placeholder |
| `Infrastructure/MultiTenancy/TenantSchemaStrategy.cs` | Placeholder |
| `Infrastructure/Persistence/Interceptors/TenantQueryFilterInterceptor.cs` | Save-changes interceptor stamping tenant |
| `Application/Behaviors/TenantFilterBehavior.cs` | MediatR pipeline behavior validating tenant context |

After deletion, also delete the `Infrastructure/MultiTenancy/` directory itself (now empty).

### 2.2 Files to EDIT (18)

| Path | What changes |
|---|---|
| `API/.../Configuration/AuthenticationSetup.cs` | Remove `MapEntraTenantToPlatformTenant()` call (~line 180) + the method body (~242–264). Keep JWT validation. |
| `API/.../Extensions/WebApplicationExtensions.cs` | Remove `app.UseMiddleware<TenantResolutionMiddleware>()` (~line 50) |
| `API/.../Extensions/ServiceCollectionExtensions.cs` | Remove tenant settings registrations + tenant DI; (also touched in §3 for context rename) |
| `Application/Behaviors/AuditBehavior.cs` | Remove `ICurrentTenantService` ctor param + `TenantId = ...` field write in audit record |
| `Application/DependencyInjection.cs` | Remove `AddOptions<MultiTenancySettings>` + `TenantFilterBehavior` registration |
| `Infrastructure/DependencyInjection.cs` | Remove `using ...MultiTenancy`, `AddValidatedOptions<MultiTenancySettings>`, `ICurrentTenantService` registration, `ITenantIsolationStrategy` registration |
| `Infrastructure/Persistence/ModelBuilderExtensions.cs` | Either remove `ApplyTenantAndSoftDeleteFilters` entirely or rename to `ApplySoftDeleteFilter` and drop the tenant branch |
| `Infrastructure/Persistence/EventShopper/Contexts/EventShopperDbContext.Extensions.cs` | Remove tenant filter call in `OnModelCreatingPartial` (also renamed in §3) |
| `Batch/Enterprise.Platform.Worker/Program.cs` | Remove tenant DI registrations if any (also touched in §3) |
| `Core/Domain/Aggregates/AggregateRoot.cs` | Inheritance: `TenantAuditableEntity` → `AuditableEntity` |
| `Infrastructure/Persistence/EventShopper/EventShopperServiceCollectionExtensions.cs` | Remove tenant interceptor (also renamed in §3) |
| `Infrastructure/Messaging/IntegrationEvents/OutboxIntegrationEventPublisher.cs` | Remove `ICurrentTenantService` injection + `TenantId = ...` from outbox stamping |
| `Infrastructure/Persistence/Outbox/OutboxMessage.cs` | Drop `Guid? TenantId` field |
| `Contracts/Enterprise.Platform.Shared/Constants/HttpHeaderNames.cs` | Remove `TenantId = "X-Tenant-ID"` constant |
| `API/Configuration/HealthCheckSetup.cs` | Health-check name `eventshopper-db` → `app-db` (also renamed in §3) |
| (Application handlers if any consume `ICurrentTenantService`) | Remove ctor param; drop tenant filtering from queries |

### 2.3 What survives

- `AuditableEntity` (CreatedBy/At, ModifiedBy/At) — kept; this is non-tenant audit metadata
- `BaseEntity` (Guid Id + RowVersion) — kept; production-grade
- `IAuditableEntity` interface — kept
- Outbox infrastructure — kept (just without TenantId column)
- Identity / Entra B2B + B2C — kept (Entra ID `tid` claim is Entra-tenant, not platform-tenant; orthogonal)

---

## 3 · Backend — EventShopper rip-out + AppDbContext rename

### 3.1 Files to DELETE (50+)

#### EventShopper entities (40 files under `Infrastructure/Persistence/EventShopper/Entities/`)

```
AiPreviews, Appointments, AuditLogs, ChatMessages, ChatSessions, CustomerProfiles,
Events, FamilyMembers, FulfillmentOrders, GarmentMeasurementMaps, Garments, Guests,
JobCards, JobCardStageLogs, MeasurementAttributes, MemberMeasurements, OrderMilestones,
Orders, OtpEntries, OutboxMessages (note: NOT the platform Outbox), Payments, Permissions,
ProductionRequests, ProductionRequestStageLogs, PromoCodes, Referrals, RefreshTokens,
Reviews, RolePermissions, Roles, ScreenMappings, Sessions, SystemCategories, SystemCodes,
SystemSettings, UserPasswordHistory, UserRoles, Users, VehicleLocations, …
```

#### EventShopper DTOs (39 files under `Contracts/Enterprise.Platform.Contracts/DTOs/EventShopper/`)
Mirror of the entity list. Delete entire folder.

#### EventShopper endpoints
- `API/.../Endpoints/v1/EventShopper/` — entire folder (currently has `RolesEndpoints.cs`)

#### EventShopper application features
- `Application/Features/EventShopper/` — entire folder (Roles commands/queries/repos)

#### Misc EventShopper files
- `Infrastructure/Persistence/EventShopper/Repositories/RolesRepository.cs` — delete (or move to `Persistence/App/Repositories/` if we want to keep it as a reference; the agent's audit suggests this repo violates UoW pattern anyway — cleaner to delete and rebuild correctly later)
- `Infrastructure/Persistence/EventShopper/Repositories/README.md` — delete

### 3.2 Files to RENAME (4)

| Old | New |
|---|---|
| `Infrastructure/Persistence/EventShopper/Contexts/EventShopperDbContext.cs` | `Infrastructure/Persistence/App/Contexts/AppDbContext.cs` |
| `Infrastructure/Persistence/EventShopper/Contexts/EventShopperDbContext.Extensions.cs` | `Infrastructure/Persistence/App/Contexts/AppDbContext.Extensions.cs` |
| `Infrastructure/Persistence/EventShopper/EventShopperServiceCollectionExtensions.cs` | `Infrastructure/Persistence/App/AppServiceCollectionExtensions.cs` |
| `Infrastructure/Persistence/EventShopper/Mappings/EventShopperMappingRegistry.cs` | `Infrastructure/Persistence/App/Mappings/AppMappingRegistry.cs` |

Inside each renamed file:
- Class name: `EventShopperDbContext` → `AppDbContext`, etc.
- Namespace: `…Persistence.EventShopper.…` → `…Persistence.App.…`
- Method name: `AddEventShopperDb` → `AddAppDb`
- Logical context name: `"EventShopper"` → `"App"`
- Connection string key: `"EventShopperDb"` → `"AppDb"`
- All entity `DbSet<>` properties: **deleted** (since entities are wiped)

### 3.3 Files to EDIT (8) — consumers of the renamed types

| Path | Change |
|---|---|
| `API/.../Extensions/ServiceCollectionExtensions.cs` | `using ...EventShopper` → `using ...App`; `AddEventShopperDb(configuration)` → `AddAppDb(configuration)` |
| `API/Configuration/HealthCheckSetup.cs` | `EventShopperDbContext` → `AppDbContext` in health-check class; check name → `"app-db"` |
| `Batch/Enterprise.Platform.Worker/Program.cs` | Same rename treatment |
| `Infrastructure/Persistence/Outbox/OutboxDbContextExtensions.cs` | Type ref `EventShopperDbContext context` → `AppDbContext context` |
| `Infrastructure/DependencyInjection.cs` | Comment refs to `EventShopperDbContext` → `AppDbContext` |
| `API/Endpoints/v1/HealthEndpoints.cs` (if it references the context) | Same |
| Any other file that grep `EventShopper` finds | Same global rename |

### 3.4 New folder structure (after rename + cleanup)

```
src/Infrastructure/Enterprise.Platform.Infrastructure/Persistence/
├── App/                                  ← was EventShopper/
│   ├── AppServiceCollectionExtensions.cs
│   ├── Contexts/
│   │   ├── AppDbContext.cs               ← skeleton (no DbSets yet)
│   │   └── AppDbContext.Extensions.cs    ← model conventions, no tenant filter
│   ├── Mappings/
│   │   └── AppMappingRegistry.cs         ← starts empty
│   ├── Configurations/                   ← (NEW) IEntityTypeConfiguration<T> per entity
│   ├── Repositories/                     ← (NEW) per-aggregate repos as features land
│   └── Migrations/                       ← (NEW) EF migrations folder
├── Outbox/
├── DbContextFactory.cs
├── DbContextRegistry.cs
├── ModelBuilderExtensions.cs             ← softdelete-only after tenant strip
├── Interceptors/
│   ├── AuditableEntityInterceptor.cs
│   ├── DomainEventDispatchInterceptor.cs
│   └── SoftDeleteInterceptor.cs
└── Specifications/
```

The new `App/Configurations/` and `App/Repositories/` folders sit empty initially — populate as real entities get added with proper `IEntityTypeConfiguration<TEntity>` (Fluent API) and aggregate-specific repository contracts.

---

## 4 · Backend — connection string + appsettings

### 4.1 Files to update

- `API/Enterprise.Platform.Api/appsettings.json`
- `API/Enterprise.Platform.Api/appsettings.Development.json`
- `Batch/Enterprise.Platform.Worker/appsettings.json`
- `Batch/Enterprise.Platform.Worker/appsettings.Development.json`

### 4.2 Before / after

```diff
 {
   "ConnectionStrings": {
-    "EventShopperDb": "Server=localhost;Database=EventShopperDb;…"
+    "AppDb": "Server=localhost;Database=EnterprisePlatform;…"
   },
   "DatabaseSettings": {
-    "DefaultConnection": "EventShopper",
+    "DefaultConnection": "App",
     "Connections": {
-      "EventShopper": {
-        "ConnectionStringName": "EventShopperDb",
+      "App": {
+        "ConnectionStringName": "AppDb",
         "Provider": "SqlServer",
         …
       }
     }
   }
 }
```

The new database `EnterprisePlatform` is created from migrations on first run via `DbContext.Database.MigrateAsync()` in a startup hook (or manually via `dotnet ef database update`).

---

## 5 · BaseEntity / AuditableEntity wiring (partial-class extension)

Since we're rip-and-restart on entities, the partial-class extension pattern doesn't apply yet (no entities exist). What we DO need to ensure:

1. **`BaseEntity`** stays as-is (Guid Id + RowVersion + IEquatable). Production-grade.
2. **`AuditableEntity`** (extends BaseEntity, adds CreatedAt/By, ModifiedAt/By) — verify the User-id field type. Currently `int` (Users.Id is int in EventShopper schema). For greenfield, **switch to `Guid?` or `string` (Entra OID)** since we're bootstrapping fresh with proper Entra-aware identity. **Recommendation: `Guid?` CreatedBy/ModifiedBy/DeletedBy** so they map to a future `User` aggregate's PK.
3. **Add `ISoftDeletable` + `SoftDeleteEntity`** that adds `DeletedAt`/`DeletedBy` fields, optional inheritance.
4. **Document the inheritance chain** in `Domain/Entities/README.md`:
   ```
   BaseEntity                    ← Guid Id + RowVersion (everything inherits)
   ├── AuditableEntity           ← + CreatedAt/By, ModifiedAt/By
   │   └── SoftDeleteEntity      ← + DeletedAt/By + ISoftDeletable
   └── AggregateRoot             ← extends AuditableEntity + IDomainEventSource
   ```

When new entities are added (Phase 1+ feature work), they hand-write under `Domain/Aggregates/<Aggregate>/` (per DDD), inherit appropriately, and have `IEntityTypeConfiguration<T>` Fluent API mapping in `Infrastructure/Persistence/App/Configurations/`. **No more EF DB-first scaffolding.** This is a deliberate methodology shift documented in the Phase-2 audit.

---

## 6 · Frontend — tenancy strip

### 6.1 Files to DELETE (3)

| Path | Reason |
|---|---|
| `src/app/core/services/tenant.service.ts` | 100% tenancy logic |
| `src/app/core/interceptors/tenant.interceptor.ts` | Adds `X-Tenant-ID` header |
| `src/app/core/interceptors/tenant.interceptor.spec.ts` | Spec for the above |

### 6.2 Files to EDIT (11)

| Path | Change |
|---|---|
| `src/app/config/app.config.ts` | Remove `tenantInterceptor` from `withInterceptors([…])` array; remove the import; update HTTP-chain docstring (drop position #2) |
| `src/app/core/interceptors/index.ts` | Remove `export { tenantInterceptor }`; renumber chain in docstring |
| `src/app/core/services/index.ts` | Remove `export { TenantService }` + the type-only re-export |
| `src/app/core/auth/auth.store.ts` | Remove `TenantService` import + injection; remove `tenantId` from state shape + `INITIAL_STATE`; remove `patchState({…tenantId})` in `hydrate.next()`; remove `tenant.setTenant(...)` in hydrate + reset; update docstring |
| `src/app/core/auth/auth.store.spec.ts` | Remove `TenantService` import + `let tenant`; remove the "hydrate patches…tenantId" + "reset clears + notifies TenantService" tests; strip `tenantId` from response fixtures + assertions |
| `src/app/core/models/auth.model.ts` | Remove `EffectivePermissions.tenantId` field; update docstrings |
| `src/app/core/http/base-api.service.ts` | Remove tenant-header docstring line |
| `src/app/core/interceptors/loading.interceptor.ts` | Renumber chain position; drop tenant mention from docstring |
| `src/app/config/primeng.config.ts` | Drop "per-tenant re-brand" comment from header docstring |
| `src/app/layouts/app-shell/app-shell.component.ts` | Drop "future per-tenant theming" comment near branding signal |
| `src/app/config/runtime-config.ts` | Drop or update the stale MSAL-tenant comment (Entra `tid` is unrelated to platform tenancy — clarify in comment) |

### 6.3 What survives (KEEP without changes)

| Path | Reason |
|---|---|
| `src/app/config/runtime-config.model.ts` | "Entra client/tenant IDs no longer live here" — refers to Entra's `tid`, not platform tenant. Context-explaining comment |
| `src/app/core/interceptors/cache.interceptor.ts` | "e.g. a pathological dashboard querying per-tenant" — example in comment, not code |
| `src/environments/environment.production.ts`, `.staging.ts` | `msal.tenantId: ''` — Entra tenant placeholder, harmless |

### 6.4 Frontend impact summary

After the strip, the SPA:
- Sends no `X-Tenant-ID` header on any request
- Has no tenant signal in `AuthStore` state
- `currentUser`/`session` shape loses the `tenantId` field (BFF already wired to not return it post-Phase 9.D, so no API-shape change is forced by this)

---

## 7 · The 8-commit execution order

Each commit is verified by `dotnet build` (backend) or `ng build` (frontend) before moving on. Frontend cleanup is interleaved so neither side is left in a permanently-broken state for long.

### Commit 1 — Delete backend tenancy-only files (safe; no DI references yet to the deletees inside the files we're editing later)

Action: delete the 13 files listed in §2.1 + the empty `MultiTenancy/` directory.

Verification:
- `dotnet build src/Infrastructure/Enterprise.Platform.Infrastructure/`
- Errors expected from the EDIT files in §2.2 referencing the deleted symbols. Move to commit 2 immediately.

### Commit 2 — Strip tenancy refs from EDIT files

Action: apply the 18 edits in §2.2.

Verification:
- `dotnet build` — should pass clean now.
- Greppable check: `grep -r "ICurrentTenantService\|ITenantEntity\|TenantAuditableEntity\|TenantQueryFilter" src/ --include="*.cs"` returns zero hits.

### Commit 3 — Rename EventShopperDbContext → AppDbContext

Action: rename the 4 files in §3.2 + update all class/namespace/method names inside.

Verification:
- Cross-file refs updated (consumers in §3.3 not yet touched will fail).
- `dotnet build` errors expected; resolve in commit 4.

### Commit 4 — Update consumers of the renamed types

Action: apply the 8 edits in §3.3 (the renames' consumers).

Verification:
- `dotnet build` — clean.
- Greppable: `grep -r "EventShopperDbContext\|AddEventShopperDb" src/ --include="*.cs"` zero hits.

### Commit 5 — Update appsettings.json connection strings

Action: apply the 4 appsettings edits in §4.

Verification:
- `dotnet build` clean (no source code changed).
- Manual: open appsettings files, confirm new keys are present.

### Commit 6 — Delete EventShopper entities + DTOs + endpoints + features (the scorched-earth pass)

Action: delete the entire EventShopper entity/DTO/endpoint/feature folders (§3.1).

Verification:
- `dotnet build` **WILL FAIL** because:
  - DbContext's `DbSet<>` properties referenced deleted types (already removed in commit 3 since we redefined `AppDbContext.cs` with no DbSets — verify this happened)
  - DI registrations pointed at deleted repos
  - Endpoints registered deleted handlers
- **Resolve in commit 7. Don't push commit 6 alone.**

### Commit 7 — Resolve compile orphans

Action:
- Remove orphan `using` statements
- Remove DI registrations for deleted handlers/repos
- Remove route group registrations for deleted endpoint files
- Stub `AppDbContext` with empty `OnModelCreating` (no DbSets, ready for new entities)
- Stub `AppMappingRegistry` (no Mapster configs yet)

Verification:
- `dotnet build` — clean
- `dotnet test` (if any tests survive) — passing
- API boots: `dotnet run --project src/API/Enterprise.Platform.Api/`
- Health check responds: `curl http://localhost:5044/health/ready`

### Commit 8 — Frontend tenancy strip

Action: apply the 14 frontend changes in §6.1 + §6.2 in this micro-order:
1. Remove `TenantService` + `tenantInterceptor` exports from barrels
2. Remove `tenantInterceptor` from `app.config.ts` chain
3. Strip `auth.store.ts` + spec
4. Strip `auth.model.ts`
5. Strip docstrings
6. Delete the 3 files

Verification:
- `npx tsc -p tsconfig.app.json --noEmit` — 0 errors
- `npx ng build --configuration=development` — clean
- `npx eslint "src/**/*.{ts,html}"` — 0 errors
- Vitest: `npx vitest run src/app/core/auth/auth.store.spec.ts` — passing
- `npm run start` + open localhost:4200, hard-reload, confirm no console errors and no `X-Tenant-ID` in any Network tab request

---

## 8 · Verification gates (final)

After commit 8, run the full verification sweep:

```bash
# Backend
cd src
dotnet build                                    # green
dotnet test                                     # green
grep -rE "Tenant|EventShopper" src --include="*.cs" \
  | grep -v "// " | grep -v "/\*" \
  || echo "✓ no tenant/EventShopper references"

# Frontend
cd src/UI/Enterprise.Platform.Web.UI/ClientApp
npx ng build --configuration=production          # green; under bundle budget
npx eslint "src/**/*.{ts,html}"                  # 0 errors
npx vitest run                                   # green
npx depcruise --config .dependency-cruiser.cjs --output-type err src    # 0 violations
grep -rE "tenant|TenantService|tenantInterceptor|X-Tenant-ID" \
  src/app/ \
  | grep -v "msal" | grep -v "Entra"
  # Expected: zero hits except documented Entra/MSAL legacy references
```

---

## 9 · Rollback plan

Each commit is small enough to revert individually with `git revert <sha>`. The risky window is between commits 6 and 7 (project doesn't compile). If the team is uncomfortable shipping during that window:

- Squash commits 6+7 into one before pushing
- Or do them on a feature branch and merge to main only once 7 lands

---

## 10 · Out of scope (intentionally deferred)

These belong to Phase 2 (per the audit doc) — not done in this migration:

- P0 fixes (correlation propagation to async event handlers; UoW separation in repositories)
- P1 fixes (EF retry policy, validation pipeline, idempotency-default policy)
- P2 patterns (cache invalidation regions, XML docs, repository abstraction polish)
- P3 polish (LoggerMessage, sealed-by-default audit)
- New entity/aggregate authoring (post-cleanup; awaits real feature requirements)
- Re-enabling Entra B2C, Outbox broker (Service Bus), real Mapster registrations

---

## 11 · Approval gate

I will NOT execute until you reply with one of:

| Reply | Action |
|---|---|
| **"go phase 1"** | Execute commits 1–8 in order, verify each gate, report status |
| **"hold X"** for specific item | Pause on item X, ask follow-up, then continue |
| **"adjust Y"** | Modify the plan (e.g., keep some EventShopper entities, different connection-string key) before execution |

---

## 12 · Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-25 | Claude (Opus 4.7) | Initial migration plan. Synthesised from parallel agent audits. Awaits user approval before any code changes. |
