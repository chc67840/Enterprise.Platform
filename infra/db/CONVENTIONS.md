# SQL Schema Conventions

> Canonical reference for everyone authoring DDL in this repo. The schema is the
> **source of truth** in this codebase — entities are scaffolded from it, not the
> other way around. If a convention here is missing or unclear, raise a PR
> against this file before writing the new pattern into a script. Tribal
> knowledge that lives only in old `.sql` files rots within a year.

---

## 1. Where scripts live

```
infra/db/
├── CONVENTIONS.md                  ← this file
├── scripts/
│   ├── App/                        ← AppDbContext target database
│   │   ├── 001-initial.sql
│   │   ├── 002-add-roles.sql       ← future
│   │   └── …
│   └── Platform/                   ← PlatformDb target database
│       └── 001-initial.sql
└── README.md                       ← short pointer to this file + how to run
```

**One folder per logical database.** `tools/Enterprise.Platform.DbMigrator`
takes the database name as a CLI argument and applies the matching folder in
filename order.

---

## 2. Filename + ordering rules

- **Pattern:** `NNN-<verb>-<subject>.sql`, e.g. `003-add-audit-trigger.sql`
- **`NNN` is a zero-padded sequence**, monotonically increasing per folder.
  Three digits give us 999 scripts; if we hit 999 we have bigger problems than
  filename collisions.
- **Filenames are immutable once merged to `main`.** A script that has run in
  any environment is part of the schema's history. To revise, write a *new*
  script that supersedes the previous behaviour. Editing an applied script
  silently bypasses the migrator's hash check (see §10) and corrupts state.
- **No timestamps in filenames.** Two devs working in parallel on `004-` and
  `005-` resolve via PR review; timestamps just hide the ordering decision.

---

## 3. Idempotent script style (mandatory)

Every script must be **safely re-runnable** even though the migrator tracks
applied scripts. Two reasons:
1. The migrator may crash mid-script; a partial apply must not leave the next
   run unable to continue.
2. Local dev environments occasionally need a "rebuild from scratch" without a
   full DB drop.

### Tables

```sql
IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users
    (
        Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Users PRIMARY KEY DEFAULT (NEWSEQUENTIALID()),
        Email               NVARCHAR(254)    NOT NULL,
        FirstName           NVARCHAR(100)    NOT NULL,
        LastName            NVARCHAR(100)    NOT NULL,
        ExternalIdentityId  UNIQUEIDENTIFIER NULL,
        IsActive            BIT              NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
        LastLoginAt         DATETIMEOFFSET(7)     NULL,
        CreatedAt           DATETIMEOFFSET(7)     NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy           NVARCHAR(256)    NULL,
        ModifiedAt          DATETIMEOFFSET(7)     NOT NULL CONSTRAINT DF_Users_ModifiedAt DEFAULT (SYSUTCDATETIME()),
        ModifiedBy          NVARCHAR(256)    NULL,
        IsDeleted           BIT              NOT NULL CONSTRAINT DF_Users_IsDeleted DEFAULT (0),
        DeletedAt           DATETIMEOFFSET(7)     NULL,
        DeletedBy           NVARCHAR(256)    NULL,
        RowVersion          ROWVERSION       NOT NULL
    );
END
GO
```

### Indexes

```sql
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_Email' AND object_id = OBJECT_ID('dbo.Users'))
    CREATE UNIQUE INDEX IX_Users_Email ON dbo.Users(Email);
GO
```

### Columns added later

```sql
IF COL_LENGTH('dbo.Users', 'PhoneNumber') IS NULL
    ALTER TABLE dbo.Users ADD PhoneNumber NVARCHAR(32) NULL;
GO
```

### Foreign keys

```sql
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Roles_Users')
    ALTER TABLE dbo.Roles ADD CONSTRAINT FK_Roles_Users
        FOREIGN KEY (OwnerUserId) REFERENCES dbo.Users(Id);
GO
```

**Always name your constraints** (`PK_*`, `FK_*`, `IX_*`, `DF_*`, `CK_*`).
SQL Server-generated names are random and break diff tools.

---

## 4. Naming

| Object        | Convention                              | Example                       |
| ------------- | --------------------------------------- | ----------------------------- |
| Schema        | `dbo` unless cross-cutting reason       | `dbo`                          |
| Table         | `PascalCase`, **singular**              | `User`, `OrderLineItem`        |
| Column        | `PascalCase`                            | `FirstName`, `ExternalIdentityId` |
| Primary key   | `PK_<Table>`                            | `PK_Users`                    |
| Foreign key   | `FK_<TableFrom>_<TableTo>`              | `FK_OrderLineItems_Orders`    |
| Index         | `IX_<Table>_<Cols>` or `UX_` if unique  | `IX_Users_Email`              |
| Default       | `DF_<Table>_<Column>`                   | `DF_Users_IsActive`           |
| Check         | `CK_<Table>_<Rule>`                     | `CK_Users_EmailLower`         |
| Trigger       | `TR_<Table>_<Verb>`                     | `TR_Users_AfterInsert`        |
| Stored proc   | `usp_<Verb><Subject>`                   | `usp_PurgeStaleOutbox`        |
| View          | `vw_<Subject>`                          | `vw_ActiveUsers`              |

**No abbreviations** unless they are domain-standard. `Email` not `Eml`,
`PhoneNumber` not `PhoneNo`. The 30-byte SQL Server limit hasn't existed since
the 90s.

**Why singular table names?** EF Core's scaffolder produces a class with the
exact table name (no built-in pluralizer). Singular tables → singular C# entities
(`User`, not `Users`) which matches .NET conventions. Plural tables would force
us either to add a third-party pluralizer (off-policy) or to manually rename
every scaffolded entity (rot-prone). DbSet members on the context stay plural
(`context.Users`, `context.OrderLineItems`) — that's idiomatic too.

---

## 5. Mandatory columns on every table

Every table that represents a domain entity (anything not a pure join table or
audit log) **must** include:

| Column      | Type                | Why                                                |
| ----------- | ------------------- | -------------------------------------------------- |
| `Id`        | `UNIQUEIDENTIFIER`  | Primary key. App generates via `Guid.NewGuid()`; SQL `DEFAULT (NEWSEQUENTIALID())` is the backstop for direct INSERTs |
| `CreatedAt` | `DATETIMEOFFSET(7)`      | Audit. App sets via `IDateTimeProvider.UtcNow`; SQL default `SYSUTCDATETIME()` is the backstop |
| `CreatedBy` | `NVARCHAR(256)`     | Audit. App sets via `ICurrentUserService.UserId` (or `"system"` for background work) |
| `ModifiedAt`| `DATETIMEOFFSET(7)`      | Audit. App sets on every update                    |
| `ModifiedBy`| `NVARCHAR(256)`     | Audit. App sets on every update                    |
| `RowVersion`| `ROWVERSION`        | Optimistic concurrency. SQL maintains; app uses for `WHERE` clause on update |

**Soft-delete columns** (when applicable — confirm with PR review):

| Column      | Type                | Notes                                              |
| ----------- | ------------------- | -------------------------------------------------- |
| `IsDeleted` | `BIT NOT NULL`      | Default `0`. Filtered indexes use this             |
| `DeletedAt` | `DATETIMEOFFSET(7) NULL` | Set when soft-deleted                              |
| `DeletedBy` | `NVARCHAR(256) NULL`|                                                    |

**Pure join tables** (e.g. `UserRoles(UserId, RoleId)`) skip the audit columns;
they get them via the parents.

---

## 6. Why `DATETIMEOFFSET(7)` and `SYSUTCDATETIME()`

- `DATETIMEOFFSET(7)` has 100-nanosecond precision and explicitly stores the UTC
  offset alongside the timestamp. We use it for **every** timestamp column.
  Reasons:
  - Maps cleanly to .NET's `DateTimeOffset` (the shape every audit interface in
    `Enterprise.Platform.Domain.Interfaces` uses). `DATETIME2` ↔ `DateTime` is
    cheaper but loses the offset; bridging the two via EF value-converters is
    avoidable plumbing.
  - The 2-byte storage overhead vs `DATETIMEOFFSET(7)` is irrelevant at the row
    counts this platform serves.
  - When a future feature *does* need a non-UTC value (rare; user-facing
    scheduling), no migration is needed.
- `SYSUTCDATETIME()` returns UTC and is implicitly cast to a
  `DATETIMEOFFSET` of `+00:00` when assigned to that column type. **All
  timestamps in this database are written as UTC.** Local-time writes are
  forbidden — they're a footgun in any system that serves users in more than
  one timezone.
- `DATETIME` (the legacy 8-byte type) has 3.33ms precision and a worse range —
  never use it in new schemas.

---

## 7. Why `NVARCHAR` (not `VARCHAR`)

- `NVARCHAR` stores UTF-16; a `LastName` of `田中` works.
- Storage cost is 2× per character vs `VARCHAR`, which is dominated by row
  overhead at small column sizes anyway.
- One exception: large-volume log/event payloads where storage size matters
  more than i18n correctness — those tables document the tradeoff in a
  comment.

---

## 8. Why `UNIQUEIDENTIFIER` PKs

| Choice                | Pros                              | Cons                              |
| --------------------- | --------------------------------- | --------------------------------- |
| `INT IDENTITY`        | Compact, fast joins               | DB-generated; round-trip to insert; collisions across DBs |
| **`UNIQUEIDENTIFIER`**| Generatable client-side; mergeable across DBs | 16 bytes; index fragmentation if random |
| `BIGINT IDENTITY`     | Same as INT, larger range         | Same DB-generation issue          |

We pick `UNIQUEIDENTIFIER` because:
1. The CQRS pipeline generates `Id` in `BaseEntity()` ctor before the entity
   ever touches the database. That eliminates the "save-then-read-Id" round
   trip pattern.
2. Outbox + integration scenarios need globally unique identifiers.
3. `NEWSEQUENTIALID()` mitigates the index-fragmentation concern (sequential
   per-server but globally unique).

**App-generated IDs win:** the `BaseEntity` constructor sets `Id = Guid.NewGuid()`.
The SQL `DEFAULT (NEWSEQUENTIALID())` is a backstop for ad-hoc inserts done
from SSMS / scripts.

---

## 9. Indexes

- **Every foreign key must have a covering index.** SQL Server doesn't create
  these automatically; missing FK indexes cause table scans on join.
- **Filtered unique indexes for nullable unique columns.** `ExternalIdentityId`
  is nullable but unique-when-present:
  ```sql
  CREATE UNIQUE INDEX UX_Users_ExternalIdentityId
      ON dbo.Users(ExternalIdentityId)
      WHERE ExternalIdentityId IS NOT NULL;
  ```
- **Add an index when a query plan demands it, not preemptively.** Each index
  costs write latency and storage; the worst databases I've worked on were
  over-indexed.

---

## 10. The migrator's hash check

`tools/Enterprise.Platform.DbMigrator` records each applied script in
`__SchemaHistory`:

| Column       | Notes                                                        |
| ------------ | ------------------------------------------------------------ |
| `ScriptName` | Filename, e.g. `001-initial.sql`. PK.                        |
| `AppliedAtUtc` | Timestamp.                                                  |
| `ScriptHash` | SHA-256 of the file contents at apply time.                  |
| `ExecutionMs`| How long the script took (helps when one starts to slow).    |

On every run, the migrator:
1. Reads the folder, sorts by filename.
2. Compares against `__SchemaHistory`.
3. For each row in history, recomputes the hash on disk. **If it differs, the
   migrator aborts with `SchemaIntegrityException`** — someone edited an
   already-applied script. Recovery: revert the edit and add a new script.
4. For each new file, runs it inside a transaction; commits + records on
   success.

This is the line of defence behind §2's "filenames are immutable" rule.

---

## 11. Forbidden constructs

- **`SELECT *`** in views, sprocs, or migration logic. Every column must be
  named so a column add doesn't silently change the contract.
- **Cursors.** If you think you need one, you need a `JOIN` instead.
- **Schema-qualified to a non-`dbo` schema** without a documented reason.
- **Application-side T-SQL strings concatenated from user input.** All
  parameterised; the migrator only runs trusted scripts from this folder.
- **`NOLOCK` hints.** Dirty reads are a debug nightmare in audit-sensitive
  systems.
- **`NEWID()` for primary keys.** Use `NEWSEQUENTIALID()` (clustered-index
  fragmentation argument from §8).

---

## 12. Worked example: adding a new column

Scenario: Product wants a `PhoneNumber` field on `Users`.

1. Pick the next sequence number: `004`.
2. Author `infra/db/scripts/App/004-add-phonenumber-to-users.sql`:
   ```sql
   IF COL_LENGTH('dbo.Users', 'PhoneNumber') IS NULL
       ALTER TABLE dbo.Users ADD PhoneNumber NVARCHAR(32) NULL;
   GO
   ```
3. Run locally: `dotnet run --project tools/Enterprise.Platform.DbMigrator -- App`
4. Re-scaffold entities:
   `dotnet ef dbcontext scaffold ... --output-dir Persistence/App/Entities --force`
5. Verify `User.cs` now has `public string? PhoneNumber { get; set; }`.
6. Re-run DtoGen (or build — MSBuild target picks it up) → `UserDto` regenerates with `PhoneNumber`.
7. Update validators / API contract / SPA form as needed.
8. Commit script + scaffolded changes + DTO regen output together.

Anti-pattern: editing `001-initial.sql` to add the column. The migrator's hash
check will refuse to run in environments where `001-initial.sql` is already
applied.

---

## 13. What's *not* in scripts

| Thing                       | Where it goes                                       |
| --------------------------- | --------------------------------------------------- |
| Reference / lookup data     | Separate `seed-*.sql` files run by the same migrator with `[Seed]` flag (TBD when first lookup table lands) |
| User-generated data         | Application code only                               |
| Test fixtures               | Test project bootstrap                              |
| Per-environment differences | Migrator parameter substitution (TBD; not needed yet) |

---

## 14. Conventions debt log

Things we deferred deliberately. Visible here so the next person knows.

- **Seed data runner** — not built yet; first lookup table forces the design.
- **Per-environment script flavours** — postpone until we have a real prod /
  staging divergence.
- **Online-only DDL** for large tables — current scripts assume small tables;
  revisit when any table approaches 10M rows.
- **Idempotent index creates with column-list change** — `IF NOT EXISTS` only
  checks the index name. Renaming columns under a same-named index is silent.
  Mitigation: include columns in the index name (`IX_Users_Email_Active`)
  when columns matter.
