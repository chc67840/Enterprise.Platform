# EventShopper repositories

DB-first scaffolded entities don't inherit from `BaseEntity` (they have integer Ids, no `RowVersion` discriminator, no marker interfaces). The Phase-5 open-generic `IGenericRepository<T> where T : BaseEntity` is **not applicable** here.

## The pattern

For every aggregate in EventShopperDb, ship **two files**:

1. **Application-tier contract** — `Application/Features/EventShopper/{Aggregate}/Repositories/I{Aggregate}Repository.cs`
   - Returns DTOs (never entities), so handlers never see Infrastructure types.
   - Exposes domain-level operations: `ListAsync`, `CountAsync`, `GetByIdAsync`, `NameExistsAsync(excludeId?)`, `CreateAsync(input)`, `UpdateAsync(id, input, rowVersion)`, `DeleteAsync(id, rowVersion)`.
   - Define `Create{Aggregate}Input` / `Update{Aggregate}Input` records alongside the interface.

2. **Infrastructure-tier impl** — `Infrastructure/Persistence/EventShopper/Repositories/{Aggregate}Repository.cs`
   - EF-backed.
   - Reads use `ProjectToType<{Aggregate}Dto>(mapper.Config)` so projection runs server-side.
   - Writes set `OriginalValue` on `RowVersion` for optimistic concurrency.
   - `DbUpdateConcurrencyException` → `ConcurrencyConflictException` translation.
   - Soft-delete: filter `r.DeletedAt == null` on reads; stamp `DeletedAt`/`DeletedBy` on deletes.

## Canonical example

`IRolesRepository` + `RolesRepository` — Phase-9 vertical slice. Copy-paste + rename for the other 38 aggregates.

## Why not extend `IGenericRepository`?

- The `BaseEntity` constraint encodes real invariants (`Guid Id`, `byte[] RowVersion`, `IEquatable<BaseEntity>`). Relaxing to `class` would make every generic repo consumer defensive.
- DB-first aggregates often have aggregate-specific reads (`NameExistsAsync`, `FindByExternalId`, etc.) that wouldn't fit a one-size-fits-all generic interface.
- Per-aggregate repos keep the feature folder self-contained — the repo's consumers (handlers + endpoint) live right next to it.

## Scaling

38 aggregates × ~2 files × ~150 lines each ≈ 11k lines of repetitive code. **DtoGen extension (H8)** emits both files automatically from the scaffolded entity shape, cutting this to a one-line codegen invocation.
