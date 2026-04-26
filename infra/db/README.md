# Database schema

DDL is the source of truth in this codebase. Entities are scaffolded from the
applied schema via `dotnet ef dbcontext scaffold` — never the other way around.

- **Conventions:** see [CONVENTIONS.md](./CONVENTIONS.md). Read this before
  writing any new script.
- **Per-database scripts:** `scripts/<DbName>/NNN-<verb>-<subject>.sql`.
  Filenames are immutable once merged.
- **Apply scripts (local):**
  ```
  dotnet run --project tools/Enterprise.Platform.DbMigrator -- App
  ```
  The migrator tracks applied scripts in `__SchemaHistory` and refuses to run
  if a previously-applied script's contents have changed (see
  [CONVENTIONS.md §10](./CONVENTIONS.md#10-the-migrators-hash-check)).
- **CI:** the migrator runs against an ephemeral SQL Server container before
  the integration-test job. The schema-drift guard re-runs `scaffold` against
  the migrated DB and fails the build if entities differ from committed.
