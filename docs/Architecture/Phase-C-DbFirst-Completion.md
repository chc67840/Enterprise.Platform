# Phase C — DB-first repair + rebuild — completion

> Branch: `feature/db-first-pivot`
> Status: complete 2026-04-26.
> Build: 0 warnings / 0 errors across 16 projects. 74 unit tests passing
> (Domain 47, Application 3, Infrastructure 1, Architecture 12, DtoGen 12).
> Api.Tests deferred per the WDAC restriction documented in
> `feedback_wdac_blocks_runtime.md`.

This phase closed the gap between the db-first scaffold (Phase A) + DtoGen
(Phase B) and a working end-to-end User feature. It also did the housekeeping
needed to retire the pre-pivot multi-tenant + code-first vestiges.

---

## C.1 — Pre-pivot residue audit

| Finding | Resolution |
|---|---|
| `Worker/Program.cs:47` mentioned the wiped `EventShopper` feature | Comment cleaned |
| `CacheKeys.ForTenant` / `TenantPrefix` were dead (single-tenant strip) | Removed; class kept for `ForPlatform` + `ForUser` |
| `IGenericRepository` remarks named "User / Role / Tenant / AuditLog / OutboxMessage" — half-deleted, half-renamed | Rewritten: clarifies that the contract serves both code-first aggregates *and* db-first scaffolded entities (they all inherit `BaseEntity` via the T4 lookup) |
| `TenantId` in `EntraIdSettings*` | Kept — refers to the Entra/IdP tenant, not application tenancy |
| `Mapster` reference in `IMapper.cs` | Kept — intentional "why-not" comment |

No `EventShopper`, no app-tenancy constructs, no Mapster runtime references remain.

---

## C.2 — Domain events relocated

`Domain/Aggregates/Users/Events/*.cs` → `Domain/Events/User/*.cs` (5 files,
namespace updated). The old path implied an aggregate root sitting at
`Domain/Aggregates/Users/`, but the User entity lives in
`Infrastructure/Persistence/App/Entities/` post-pivot. The new layout puts
events under the Domain layer (correct per Clean Arch) without the
misleading `Aggregates/` prefix.

Single consumer (`User.Behavior.cs`) updated to the new namespace.

---

## C.3 — Outbox infrastructure consolidated

Pre-pivot state: hand-authored `Persistence/Outbox/OutboxMessage.cs` +
`OutboxSchemaBootstrapper` (a `IHostedService` that did `IF NOT EXISTS …
CREATE TABLE` at startup). New state: scaffolded
`Persistence/App/Entities/PlatformOutboxMessage.cs` (table is owned by
`infra/db/scripts/App/001-initial.sql`).

| Removed | Replaced by |
|---|---|
| `Persistence/Outbox/OutboxMessage.cs` | `Persistence/App/Entities/PlatformOutboxMessage.cs` (scaffolded; inherits `BaseEntity` via T4 lookup) |
| `Persistence/Outbox/OutboxDbContextExtensions.cs` (`OutboxSchemaBootstrapper`) | `tools/Enterprise.Platform.DbMigrator` + `infra/db/scripts/App/003-add-rowversion-to-outbox.sql` |
| Duplicate `DbSet<OutboxMessage> PlatformOutbox` in `AppDbContext.Extensions.cs` | Scaffolded `DbSet<PlatformOutboxMessage>` on the main `AppDbContext` partial |
| Duplicate Outbox `OnModelCreating` block in `AppDbContext.Extensions.cs` | Scaffolder owns the per-entity config now |
| `OutboxTableVerified` / `OutboxTableEnsureFailed` log messages (event ids 2701, 2702) | Retired — schema lives in source-controlled SQL |
| `services.AddHostedService<OutboxSchemaBootstrapper>()` in `DependencyInjection.cs` | Migrator is now a build-time / CI step |

Plus a small `PlatformOutboxMessage.Behavior.cs` partial that exposes a
`static Create(integrationEvent, payload, correlationId, traceId)` factory.
Why a factory rather than direct property assignment? `BaseEntity.Id` has a
`protected set` — the factory lives inside the derived class so it can set
`Id = integrationEvent.EventId` for the dedupe-key invariant ("outbox row Id ==
integration-event Id when the event supplies one"). `OutboxIntegrationEventPublisher`
calls `PlatformOutboxMessage.Create(...)` instead of constructing the entity
inline.

`OutboxProcessorJob` (in Worker) updated:
- `context.PlatformOutbox` → `context.PlatformOutboxMessage`
- `m.CreatedAt` → `m.OccurredAt`
- `DateTime.UtcNow` → `DateTimeOffset.UtcNow` (matches scaffolded `DATETIMEOFFSET(7)` columns)
- `NextAttemptAt == null` predicate dropped — column is now `NOT NULL` with a SQL `DEFAULT (SYSUTCDATETIME())`, so every row has a value at insert time.

---

## C.4 — User feature rebuilt against scaffolded shape

Replaces every Phase-1 / pre-pivot file in the User feature with a db-first equivalent.

### Files added

| Path | Purpose |
|---|---|
| `src/Core/.../Application/Abstractions/Persistence/IUserRepository.cs` | DTO-returning per-aggregate contract; reads + writes; **no `SaveChangesAsync` allowed inside any impl** |
| `src/Core/.../Application/Features/Users/Commands/CreateUser.cs` | command + validator + handler — handler delegates to `IUserRepository.RegisterAsync` after pre-flight `EmailExistsAsync` check |
| `…/RenameUser.cs`, `…/ChangeUserEmail.cs`, `…/ActivateUser.cs`, `…/DeactivateUser.cs` | Same shape — markers (`IRequiresAudit`, `ICacheRegionInvalidating`, `IIdempotent`), validator, thin handler |
| `…/Application/Features/Users/Queries/GetUserById.cs`, `ListUsers.cs` | `IQuery` with `ICacheable`; handler delegates to repo (which uses `IMapper` + DtoGen extension methods internally) |
| `src/Infrastructure/.../Persistence/App/Repositories/UserRepository.cs` | EF impl. Reads use `AsNoTracking()` + `.ToDto()`; writes load entity, call behavior method on the partial (`User.Register`, `Activate`, etc.), let `TransactionBehavior` flush. Domain `BusinessRuleViolationException` is converted to `Result.Failure(Error.Conflict(...))` |
| `src/API/.../Endpoints/v1/Users/UserEndpoints.cs` | 7 minimal-API endpoints under `/api/v1/users` via `MapPlatformApiV1Group()` (auto-idempotency); typed-Results unions with a `ResolveStatus` helper that maps `ErrorCodes` → HTTP status |

### DI wiring

`AppServiceCollectionExtensions.AddAppDb` now registers `IUserRepository → UserRepository`. `WebApplicationExtensions.UsePlatformPipeline` re-adds `app.MapUserEndpoints()`.

### Pattern shift vs the code-first version

| Before (code-first) | After (db-first) |
|---|---|
| `Email` + `PersonName` value objects with `Result<T>.Create(...)` factories | Flat `string` columns; FluentValidation rules cover format |
| Repository returned `User` entity (Domain type) | Repository returns `UserDto` (Contracts type) — handlers never touch Infrastructure types |
| `UserConfiguration : IEntityTypeConfiguration<User>` (Fluent API) | Scaffolder's `OnModelCreating` body owns the config; partial `OnModelCreatingPartial` only adds the soft-delete filter + IsActive `ValueGeneratedNever` override |
| `IUserReadProjection` interface (separate read surface) | Folded into `IUserRepository` (single contract; reads use `AsNoTracking`) |

---

## C.5 — Scaffold gotchas

**Fixed:** `IsActive` had a SQL `DEFAULT (1)` which the scaffolder picked up
as `entity.Property(e => e.IsActive).HasDefaultValue(true, ...)`. EF reads
that as `ValueGenerated.OnAdd` and silently swaps an application-supplied
`IsActive = false` for the DB default on INSERT. Override added in
`AppDbContext.Extensions.cs.OnModelCreatingPartial`:

```csharp
modelBuilder.Entity<User>().Property(u => u.IsActive).ValueGeneratedNever();
```

The SQL default still applies for direct INSERT statements that omit the
column (SSMS / data-load scripts) — the override only affects EF-generated
INSERTs.

**Documented, not fixed:** scaffolded DbSet members are singular
(`context.User`, `context.PlatformOutboxMessage`). Idiomatic EF convention is
plural. EF Core 10's scaffolder ships without a built-in pluralizer (the team
removed it some versions ago) and we don't want a third-party dep. Workable
as-is; cosmetic only. Could be revisited via a custom `IPluralizer` plugin if
the team feels strongly.

---

## C.6 — Production readiness — already in place

Inventoried what was already mature before this phase; no net-new wiring needed:

| Concern | Wired by |
|---|---|
| Polly retry / circuit-breaker on outbound HTTP + general | `services.AddStandardResiliencePipeline()` in `DependencyInjection.cs`; custom pipeline in `Infrastructure/Resilience/ResiliencePipelineSetup.cs` |
| EF transient-error retry | Intentionally NOT enabled at the DbContext level (would conflict with `TransactionBehavior` opening user-initiated transactions). Handlers needing retryable transactional units use `Database.CreateExecutionStrategy().ExecuteAsync(...)` per the doc on `AppServiceCollectionExtensions` |
| Azure Key Vault binding | `host.Configuration.AddPlatformKeyVaultIfConfigured()` in both `Api/Program.cs` and `Worker/Program.cs`; activates when `Azure:KeyVaultUri` is populated, no-op otherwise |
| PII scrubbing | `Infrastructure/Observability/PiiScrubber.cs` (regex-based redaction) + `[AuditIgnore]` attribute in `Application.Abstractions.Behaviors` for fields that shouldn't reach the audit store |
| Audit trail | `IAuditWriter` + `AuditBehavior` in MediatR pipeline; commands marked `IRequiresAudit` get a row before the transaction commits |
| Cancellation tokens | New repository / handler / endpoint methods all propagate `CancellationToken` end-to-end (verified via grep) |
| Idempotency | `IIdempotent` marker + `IdempotencyBehavior` + the `MapPlatformApiV1Group()` endpoint filter (consumes `X-Idempotency-Key` header) |

Every new C.4 file inherits these for free via the existing pipeline + DI
wiring — no code changes needed.

---

## Open items deferred from this phase

| Item | Why deferred | Where it should land |
|---|---|---|
| Schema-drift CI job (originally Phase C.4 in the plan) | CI infra not yet in scope on this branch | Add to `.github/workflows/` when the team stands up CI for this repo |
| Domain unit tests for `User.Behavior.cs` (Activate, Deactivate, Rename invariants) | Time-boxing | Quick xUnit suite using an in-memory `Guid.NewGuid()` user fixture; can reuse the test patterns from `Domain.Tests` |
| `PlatformOutboxMessageDto` is generated but unused | DtoGen treats every entity uniformly; the outbox is internal-only | Add a `skipEntities` config option to DtoGen (Phase B follow-up) so internal entities don't generate noise |
| Two-pass MSBuild build after entity changes | DtoGen target emits files inside Contracts BeforeBuild; the source `<Compile>` glob is concretized before Exec runs, so newly-emitted files aren't picked up until the second build | Document; consider splitting DtoGen into a pre-solution-build step (or moving emission to `BeforeTargets="CoreCompile"` with explicit `<Compile Include="..." />` injection) |

---

## Verification snapshot

```text
$ dotnet build Enterprise.Platform.slnx --nologo -v minimal
... 16 projects ...
Build succeeded.
    0 Warning(s)
    0 Error(s)

$ dotnet test tests/Enterprise.Platform.Domain.Tests          → 47 / 47
$ dotnet test tests/Enterprise.Platform.Application.Tests     →  3 /  3
$ dotnet test tests/Enterprise.Platform.Infrastructure.Tests  →  1 /  1
$ dotnet test tests/Enterprise.Platform.Architecture.Tests    → 12 / 12
$ dotnet test tests/Enterprise.Platform.DtoGen.Tests          → 12 / 12

Schema state:
  __SchemaHistory has 3 rows:
    001-initial.sql                         (Users, PlatformOutboxMessages, indexes)
    002-rename-tables-singular.sql          (sp_rename + index/constraint renames)
    003-add-rowversion-to-outbox.sql        (ROWVERSION column for BaseEntity contract)

Generated artefacts:
  src/Contracts/.../DTOs/App/UserDto.cs                          (DtoGen, 14 props)
  src/Contracts/.../DTOs/App/PlatformOutboxMessageDto.cs         (DtoGen, 10 props — unused; see Open Items)
  src/Infrastructure/.../Mappings/App/UserMappers.cs             (DtoGen)
  src/Infrastructure/.../Mappings/App/PlatformOutboxMessageMappers.cs (DtoGen)
  src/Infrastructure/.../Mappings/App/AppMappingRegistry.cs      (DtoGen, 2 entries)

Branch: feature/db-first-pivot — ready to PR back to main.
```

---

## Rollback / backout plan

Each phase committed separately on the branch (per the original plan). To
revert to Phase A only (drop B + C): `git reset --hard <phase-A-commit>`.
To revert the whole pivot: `git checkout main` and let the branch sit (or
delete it). Code-first User implementation lives in `main`'s history and can
be cherry-picked back if needed.
