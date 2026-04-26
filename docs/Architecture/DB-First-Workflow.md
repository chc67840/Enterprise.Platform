# Db-first Workflow

> Canonical reference for working with the database in this repo. **Schema is
> the source of truth**; entities are derived from it. If you find yourself
> editing a scaffolded `User.cs` by hand, stop and read this doc.

---

## TL;DR

| You want to                                  | Run                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Apply pending DDL changes locally            | `dotnet run --project tools/Enterprise.Platform.DbMigrator -- App`                                    |
| Add a new column                             | New file `infra/db/scripts/App/NNN-<verb>-<subject>.sql` → run migrator → re-scaffold (see §3)        |
| Re-scaffold entities after a schema change   | See [§3 — Re-scaffold](#3--re-scaffold-entities-after-schema-changes)                                |
| Verify schema ⇄ entities haven't drifted     | `dotnet run --project tools/Enterprise.Platform.DbMigrator -- App` then re-scaffold to a temp dir + diff |
| See what scripts have been applied           | `SELECT * FROM dbo.__SchemaHistory ORDER BY AppliedAtUtc;` in SSMS                                   |

---

## 1. Pieces of the puzzle

```
┌─────────────────────────────────┐
│  infra/db/scripts/<DB>/*.sql    │   ← source of truth
└──────────────┬──────────────────┘
               │ run by
               ▼
┌─────────────────────────────────┐
│  tools/.../DbMigrator           │   ← idempotent applier; tracks state in __SchemaHistory
└──────────────┬──────────────────┘
               │ produces
               ▼
┌─────────────────────────────────┐
│  SQL Server database            │
└──────────────┬──────────────────┘
               │ reverse-engineered by
               ▼
┌─────────────────────────────────┐
│  dotnet ef dbcontext scaffold   │   ← uses CodeTemplates/EFCore/*.t4
└──────────────┬──────────────────┘
               │ writes
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  src/Infrastructure/.../Persistence/<DB>/Entities/<Entity>.cs               │
│  src/Infrastructure/.../Persistence/<DB>/Contexts/<DB>DbContext.cs          │
└─────────────────────────────────────────────────────────────────────────────┘
```

The customised T4 templates at
`src/Infrastructure/Enterprise.Platform.Infrastructure/CodeTemplates/EFCore/`
control three things:

1. **Adds platform base class.** A lookup at the top of `EntityType.t4` maps
   entity names to base classes (`AggregateRoot` / `AuditableEntity` /
   `BaseEntity`).
2. **Strips audit columns** (`Id`, `CreatedAt/By`, `ModifiedAt/By`,
   `RowVersion`) from the scaffolded property list when the entity inherits
   one of those bases — they're owned by the base, scaffolding them too would
   produce CS0102 duplicate-member errors.
3. **Keeps the `partial` modifier** that the default template already emits,
   so behaviour can live in a sibling `<Entity>.Behavior.cs` file without
   being clobbered on the next re-scaffold.

---

## 2. Local dev — first-time setup

You need:
- SQL Server (LocalDB ships with Visual Studio; `sqllocaldb info MSSQLLocalDB`
  to verify it's available).
- The `dotnet-ef` global tool: `dotnet tool install --global dotnet-ef`.

Steps:

```bash
# 1. Ensure LocalDB instance is running.
sqllocaldb start MSSQLLocalDB

# 2. Apply scripts. First run creates the database and __SchemaHistory.
dotnet run --project tools/Enterprise.Platform.DbMigrator -- App

# 3. (Optional) re-scaffold to verify the entities match what we expect.
#    See §3.
```

The migrator reads the connection string from
`tools/Enterprise.Platform.DbMigrator/appsettings.Development.json`
(LocalDB by default). Override per-developer with the
`EP_DBMIGRATOR_APP_CONNECTION` environment variable; do not commit personal
strings into the appsettings file.

---

## 3. Re-scaffold entities after schema changes

After you've authored a new `NNN-*.sql` and applied it via the migrator:

```bash
dotnet ef dbcontext scaffold "<conn-string>" Microsoft.EntityFrameworkCore.SqlServer \
    --project src/Infrastructure/Enterprise.Platform.Infrastructure         \
    --startup-project src/Infrastructure/Enterprise.Platform.Infrastructure \
    --output-dir Persistence/App/Entities                                   \
    --context AppDbContext                                                  \
    --context-dir Persistence/App/Contexts                                  \
    --use-database-names                                                    \
    --no-onconfiguring                                                      \
    --no-pluralize                                                          \
    --force
```

Notes:
- `--use-database-names` keeps property names = column names (no EF
  pluraliser silliness).
- `--no-onconfiguring` skips the auto-generated `OnConfiguring` overload
  (we register the context via DI, not via that hook).
- `--no-pluralize` keeps the DbSet name = the entity name (singular).
- `--force` overwrites previously-scaffolded files. **Sibling
  `*.Behavior.cs` files are NOT touched** because the scaffolder doesn't
  know about them.

After the command returns, **review the diff**. The customised T4 templates
should keep changes minimal — usually just the new column you added.

---

## 4. Adding a new entity (worked example)

Scenario: Product wants a `Roles` table linked to `Users`.

```bash
# 1. Author the script.
cat > infra/db/scripts/App/002-add-roles.sql <<'EOF'
IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Roles (
        Id          UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_Roles PRIMARY KEY DEFAULT (NEWSEQUENTIALID()),
        Name        NVARCHAR(64)      NOT NULL,
        Description NVARCHAR(512)     NULL,
        CreatedAt   DATETIMEOFFSET(7) NOT NULL CONSTRAINT DF_Roles_CreatedAt  DEFAULT (SYSUTCDATETIME()),
        CreatedBy   NVARCHAR(256)     NULL,
        ModifiedAt  DATETIMEOFFSET(7) NOT NULL CONSTRAINT DF_Roles_ModifiedAt DEFAULT (SYSUTCDATETIME()),
        ModifiedBy  NVARCHAR(256)     NULL,
        RowVersion  ROWVERSION        NOT NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Roles_Name' AND object_id = OBJECT_ID(N'dbo.Roles'))
    CREATE UNIQUE INDEX IX_Roles_Name ON dbo.Roles(Name);
GO
EOF

# 2. Apply.
dotnet run --project tools/Enterprise.Platform.DbMigrator -- App

# 3. Tell the T4 template the new entity should inherit AggregateRoot.
#    Edit CodeTemplates/EFCore/EntityType.t4 → entityBaseClasses:
#        { "Role", "AggregateRoot" },

# 4. Re-scaffold.
dotnet ef dbcontext scaffold ... --force        # see §3 for the full args

# 5. Add Persistence/App/Entities/Role.Behavior.cs with Register/Rename/etc.
#    (Scaffolded Role.cs is the anaemic POCO; behaviour lives in the partial.)

# 6. (When DtoGen is wired — Phase B) regenerate DTOs + mappers.
#    For now, hand-author RoleDto next to UserDto.

# 7. Run tests + commit script + scaffold + behavior file together.
```

---

## 5. CI integration

Two CI jobs cover the db-first contract:

### 5.1 — `db-migrator` job (runs before integration tests)

```yaml
- name: Spin up SQL Server
  run: docker run -d --name sql -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='<gen>' -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest

- name: Apply DDL
  run: dotnet run --project tools/Enterprise.Platform.DbMigrator -- App
  env:
    EP_DBMIGRATOR_APP_CONNECTION: "Server=localhost,1433;Database=EnterprisePlatform;User Id=sa;Password=<gen>;TrustServerCertificate=True;"
```

Exit code 0 = ready for tests. Non-zero = build red.

### 5.2 — `schema-drift` job (runs on every PR)

```yaml
- name: Re-scaffold to /tmp
  run: dotnet ef dbcontext scaffold "$CONN" Microsoft.EntityFrameworkCore.SqlServer \
       --project src/Infrastructure/Enterprise.Platform.Infrastructure \
       --output-dir /tmp/scaffold-out \
       --use-database-names --no-onconfiguring --no-pluralize --force

- name: Diff against committed entities
  run: |
    diff -r /tmp/scaffold-out src/Infrastructure/Enterprise.Platform.Infrastructure/Persistence/App/Entities \
      || (echo "Entities have drifted from schema. Re-scaffold and commit."; exit 1)
```

The diff catches:
- A column added to SQL but the entity wasn't re-scaffolded.
- A scaffolded file edited by hand (any change shows up).
- A change to the T4 template that wasn't propagated to entity files.

---

## 6. Recovery scenarios

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| `SchemaIntegrityException` from migrator | Someone edited an applied script | Revert the edit. If the new content is needed, write a new script. See `infra/db/CONVENTIONS.md` §10. |
| Runtime `SqlException: invalid column name` | DDL added a column; entities not re-scaffolded | Run scaffold (§3); commit. |
| Build error CS0102 on a scaffolded entity | Audit column made it through | Add the column name to `auditColumnsToSkip` in `EntityType.t4`; re-scaffold. |
| Build error: `'X.Behavior.cs' references property 'Y' that doesn't exist on 'X'` | Scaffold output dropped a property the behavior file relied on | Either restore the property in SQL (then re-scaffold), or update the behavior to match the new shape. |
| `__SchemaHistory` row missing for a script you wrote | You ran the migrator with `--dry-run` | Re-run without `--dry-run`. |

---

## 7. What's intentionally NOT here

- **EF Core migrations.** `dotnet ef migrations add` is forbidden in db-first.
  The migrations folder we removed in Phase 4 stays removed — the SQL scripts
  are authoritative.
- **DbContext.OnModelCreating customisation per entity.** Most of what was
  there in code-first lives in SQL now (indexes, defaults, RowVersion).
  Only conversions (e.g. enum → string) and global query filters remain in
  `OnModelCreating`. Keep those minimal.
- **Mapster / AutoMapper.** Object mapping goes through `tools/Enterprise.Platform.DtoGen`
  (Phase B) which emits extension-method mappers + an `IMapper` façade. No
  third-party runtime mapping dependency.

---

## 8. Production deploy story

Out of scope for this doc — see `infra/bicep/` for the Azure SQL setup. The
migrator runs as a pre-deploy step in the release pipeline, against the same
SQL the API will then connect to. `__SchemaHistory` is replicated like any
other table; backup / restore covers it.
