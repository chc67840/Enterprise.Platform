# User Aggregate — Canonical Pattern Walkthrough

> Status: shipped 2026-04-26 against `main`. All 75 unit tests + 12 architecture
> tests green; `dotnet build Enterprise.Platform.slnx` warning-free across 14
> projects; EF `InitialCreate` migration commits the schema.

This document is the **template** for every new aggregate. Whenever a future
feature needs a write model + read model, copy this scaffold and rename. The
patterns here are not aspirational — they're enforced by the build, the
analyzers, and the architecture-tests suite.

If you find yourself deviating from this guide, either you've discovered a
genuinely new shape (update this doc) or you're about to break a convention
test (don't).

---

## 1. Why "User" first?

User has *just* enough surface area to exercise every pattern in the platform
without dragging in domain-specific noise:

| Concern                          | How User exercises it                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| Aggregate root + base entity     | Inherits `AggregateRoot` (Guid PK, RowVersion, audit fields, domain-event collection)    |
| Value objects                    | `Email` (existing) + `PersonName` (new) mapped via `OwnsOne`                              |
| Domain events                    | 5 events (`UserRegistered`, `UserNameChanged`, `UserEmailChanged`, `UserActivated`, `UserDeactivated`) |
| Repository / Unit-of-Work split  | `IUserRepository` stages, `TransactionBehavior` flushes — no `SaveChanges` in the repo   |
| MediatR command/query pipeline   | 5 commands + 2 queries, all routed through behaviors                                     |
| Marker-interface contracts       | `IRequiresAudit`, `ICacheRegionInvalidating`, `IIdempotent`, `ICacheable`                |
| Read-model projection            | `IUserReadProjection` keeps EF out of feature handlers                                   |
| Minimal-API surface              | 7 endpoints under `/api/v1/users` via `MapPlatformApiV1Group`                            |
| EF migration                     | `20260426040024_InitialCreate` ships the table + indexes                                 |

If a future aggregate doesn't touch one of those rows, you can drop the
corresponding piece. If it touches something *not* on the list, escalate before
inventing a new pattern.

---

## 2. File map

```
src/
├── Core/
│   ├── Enterprise.Platform.Domain/
│   │   ├── Aggregates/Users/
│   │   │   ├── User.cs                          # aggregate root (sealed)
│   │   │   ├── IUserRepository.cs               # write-side abstraction
│   │   │   └── Events/
│   │   │       ├── UserRegistered.cs
│   │   │       ├── UserNameChanged.cs
│   │   │       ├── UserEmailChanged.cs
│   │   │       ├── UserActivated.cs
│   │   │       └── UserDeactivated.cs
│   │   └── ValueObjects/
│   │       └── PersonName.cs                    # new VO (Email already existed)
│   │
│   └── Enterprise.Platform.Application/
│       ├── Abstractions/Persistence/
│       │   └── IUserReadProjection.cs           # EF-bound reads live behind this
│       └── Features/Users/
│           ├── Dtos/UserDto.cs
│           ├── Commands/
│           │   ├── CreateUser.cs                # command + validator + handler
│           │   ├── RenameUser.cs
│           │   ├── ChangeUserEmail.cs
│           │   ├── ActivateUser.cs
│           │   └── DeactivateUser.cs
│           └── Queries/
│               ├── GetUserById.cs               # delegates to IUserReadProjection
│               └── ListUsers.cs                 # ditto
│
├── Infrastructure/
│   └── Enterprise.Platform.Infrastructure/
│       └── Persistence/App/
│           ├── AppServiceCollectionExtensions.cs   # adds repo + projection registrations
│           ├── Configurations/UserConfiguration.cs # EF Fluent API
│           ├── Projections/UserReadProjection.cs   # EF-bound read implementation
│           ├── Repositories/UserRepository.cs
│           └── Migrations/
│               ├── 20260426040024_InitialCreate.cs
│               ├── 20260426040024_InitialCreate.Designer.cs
│               ├── AppDbContextModelSnapshot.cs
│               └── .editorconfig                # silences analyzer noise on generated migrations
│
└── API/
    └── Enterprise.Platform.Api/
        ├── Endpoints/v1/Users/UserEndpoints.cs
        └── Extensions/WebApplicationExtensions.cs   # MapUserEndpoints() wired here
```

---

## 3. Layer-by-layer pattern catalogue

### 3.1 Domain — `User.cs`

```csharp
public sealed class User : AggregateRoot
{
    private User() { }                               // EF reflective ctor — private, not protected

    private User(Email email, PersonName name, DateTime utcNow, Guid? externalIdentityId)
    {
        Email = email;
        Name  = name;
        ExternalIdentityId = externalIdentityId;
        IsActive = true;
        CreatedAt = utcNow;
        ModifiedAt = utcNow;
        Raise(new UserRegistered(Id, email.Value, name.DisplayName, utcNow));
    }

    public Email      Email   { get; private set; } = default!;
    public PersonName Name    { get; private set; } = default!;
    public Guid?      ExternalIdentityId { get; private set; }
    public bool       IsActive { get; private set; }
    public DateTime?  LastLoginAt { get; private set; }

    public static User Register(Email email, PersonName name, DateTime utcNow, Guid? externalIdentityId = null)
        => new(email, name, utcNow, externalIdentityId);

    public void Rename(PersonName newName, DateTime utcNow) { /* guard + Raise(...) */ }
    public void ChangeEmail(Email newEmail, DateTime utcNow) { /* guard + Raise(...) */ }
    public void Activate(DateTime utcNow) { /* idempotency guard + Raise(...) */ }
    public void Deactivate(string reason, DateTime utcNow) { /* guard + Raise(...) */ }
    public void RecordLogin(DateTime utcNow)               { LastLoginAt = utcNow; ModifiedAt = utcNow; }
    public void LinkExternalIdentity(Guid externalIdentityId, DateTime utcNow) { /* … */ }
}
```

**Pattern rules:**
- `sealed` on the aggregate root unless inheritance is a documented requirement
  (sealed catches accidental subclassing in feature code; analyzer CA1852 flags
  the rest).
- `private` constructor for EF (sealed disallows `protected`). EF's
  `BindingFlags.NonPublic` reflection materialiser handles private ctors.
- All mutations raise a matching domain event. Don't add a method that changes
  state without a corresponding event — the dispatcher needs the trail.
- `BusinessRuleViolationException` for "would violate an invariant" (e.g.
  activating an active user). The middleware turns it into a 409.

### 3.2 Domain — value objects

`Email` already existed; `PersonName` is the new one. Pattern:

```csharp
public sealed class PersonName : ValueObject
{
    public const int MaxPartLength = 100;
    public string FirstName { get; }
    public string LastName  { get; }
    public string DisplayName => $"{FirstName} {LastName}";

    public static Result<PersonName> Create(string? firstName, string? lastName) { /* … */ }
    protected override IEnumerable<object?> GetEqualityComponents() { /* both parts */ }
}
```

Returning `Result<T>` from `Create` instead of throwing means the command
handler surfaces `Result.Failure(emailResult.Error)` cleanly to the caller —
the validation pipeline behavior never sees these failures because they're
*field-level* facts, not API-shape facts.

### 3.3 Domain — events

```csharp
public sealed record UserRegistered(Guid UserId, string Email, string DisplayName, DateTime OccurredOn) : IDomainEvent;
```

Records, sealed, all data on the event so the handler doesn't need to re-fetch.

### 3.4 Domain — repository interface

```csharp
public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<User?> GetByEmailAsync(Email email, CancellationToken ct = default);
    Task<User?> GetByExternalIdentityAsync(Guid externalIdentityId, CancellationToken ct = default);
    Task        AddAsync(User user, CancellationToken ct = default);
    void        Remove(User user);
    Task<bool>  EmailExistsAsync(Email email, CancellationToken ct = default);
}
```

**No `SaveChangesAsync`.** Anywhere. The `TransactionBehavior` in the MediatR
pipeline owns the unit of work. Adding a flush inside a repo method silently
breaks cross-aggregate transactions and was explicitly called out in the P0-2
audit.

### 3.5 Infrastructure — `UserConfiguration`

```csharp
builder.ToTable("Users");
builder.HasKey(u => u.Id);
builder.Property(u => u.RowVersion).IsRowVersion();

builder.OwnsOne(u => u.Email, e =>
{
    e.Property(p => p.Value).HasColumnName("Email").HasMaxLength(254).IsRequired();
    e.HasIndex(p => p.Value).IsUnique().HasDatabaseName("IX_Users_Email");
});

builder.OwnsOne(u => u.Name, n =>
{
    n.Property(p => p.FirstName).HasColumnName("FirstName").HasMaxLength(PersonName.MaxPartLength).IsRequired();
    n.Property(p => p.LastName).HasColumnName("LastName").HasMaxLength(PersonName.MaxPartLength).IsRequired();
});

builder.HasIndex(u => u.ExternalIdentityId)
    .IsUnique()
    .HasFilter("[ExternalIdentityId] IS NOT NULL")
    .HasDatabaseName("IX_Users_ExternalIdentityId");

builder.Ignore(u => u.DomainEvents);   // dispatched by the interceptor; never persisted
```

**Pattern rules:**
- Value objects → `OwnsOne` with explicit column names. Never let EF synthesise
  `Email_Value` — the migration becomes unreviewable.
- Filtered unique indexes for nullable columns. SQL Server is happy to allow
  multiple NULLs and a single non-NULL.
- `Ignore(DomainEvents)` is non-negotiable — `DomainEventDispatchInterceptor`
  reads them on save and clears them; persisting them would be both wasteful
  and double-publishing-prone.

### 3.6 Infrastructure — `UserRepository`

The `DomainEmail` alias trip-wire:

```csharp
using DomainEmail = Enterprise.Platform.Domain.ValueObjects.Email;
```

`Enterprise.Platform.Infrastructure.Email` is an SMTP namespace; a bare
`Email` reference inside the Infrastructure assembly resolves to that namespace
*before* the using import for the value object. Aliasing makes parameter
declarations unambiguous.

### 3.7 Application — read-projection abstraction (the bit that's easy to get wrong)

Architecture test `Application_Should_Not_Depend_On_EntityFrameworkCore`
forbids `Microsoft.EntityFrameworkCore` references **anywhere in the
Application assembly except `Enterprise.Platform.Application.Abstractions.Persistence`**.

That means a query handler **cannot** call `.ToListAsync()`,
`EF.Functions.Like(...)`, `.AsNoTracking()`, etc.

Solution shape:

```
Application/
  Abstractions/Persistence/IUserReadProjection.cs          ← interface only, returns DTOs
  Features/Users/Queries/GetUserById.cs                    ← handler delegates
  Features/Users/Queries/ListUsers.cs                      ← handler delegates
Infrastructure/
  Persistence/App/Projections/UserReadProjection.cs        ← EF-bound implementation
```

The handler shrinks to:

```csharp
public sealed class GetUserByIdHandler(IUserReadProjection projection) : IQueryHandler<GetUserByIdQuery, Result<UserDto>>
{
    public async Task<Result<UserDto>> HandleAsync(GetUserByIdQuery query, CancellationToken ct = default)
    {
        var dto = await _projection.GetByIdAsync(query.UserId, ct).ConfigureAwait(false);
        return dto is null
            ? Result.Failure<UserDto>(Error.NotFound($"User {query.UserId} not found."))
            : Result.Success(dto);
    }
}
```

The projection in Infrastructure does the LIKE / paging / `ToListAsync` work
behind the interface. Both layers compile cleanly; the architecture test stays
green.

### 3.8 Application — commands carry marker interfaces, not magic

```csharp
public sealed record CreateUserCommand(string Email, string FirstName, string LastName, Guid? ExternalIdentityId)
    : ICommand<Result<UserDto>>,
      IRequiresAudit,
      ICacheRegionInvalidating,
      IIdempotent
{
    public string AuditAction  => "CreateUser";
    public string? AuditSubject => Email.ToLowerInvariant();
    public IEnumerable<string> CacheRegionsToInvalidate() { yield return "users"; }
    public string IdempotencyKey { get; init; } = string.Empty;     // header sets this
}
```

Marker interfaces drive the pipeline behaviours by *type*, not by attribute or
config. Adding `IRequiresAudit` is the only step required to start auditing the
command; deleting it is the only step to stop. No registry to maintain.

### 3.9 API — minimal-API endpoints

```csharp
var group = app.MapPlatformApiV1Group()    // gives every endpoint IdempotencyEndpointFilter
    .MapGroup("/users")
    .RequireAuthorization()
    .WithTags("Users");

group.MapGet ("/{id:guid}", GetUserByIdAsync)         .WithName("GetUserById");
group.MapGet ("/",          ListUsersAsync)           .WithName("ListUsers");
group.MapPost("/",          CreateUserAsync)          .WithName("CreateUser");
group.MapPut ("/{id:guid}/name",   RenameUserAsync)   .WithName("RenameUser");
group.MapPut ("/{id:guid}/email",  ChangeUserEmailAsync).WithName("ChangeUserEmail");
group.MapPost("/{id:guid}/activate",   ActivateUserAsync)  .WithName("ActivateUser");
group.MapPost("/{id:guid}/deactivate", DeactivateUserAsync).WithName("DeactivateUser");
```

**Pattern rules:**
- Always go through `MapPlatformApiV1Group()` — that's where the
  `IdempotencyEndpointFilter` lives and where the BFF expects the route prefix.
- `Results<Created<T>, ProblemHttpResult>` and friends — typed unions so
  OpenAPI sees both branches.
- Body records (`RenameUserBody`, `ChangeUserEmailBody`, `DeactivateUserBody`)
  live next to the endpoint that uses them, not in a shared `Models/`
  graveyard.

### 3.10 EF migration — generated code, generated rules

Adding a migration:

```bash
dotnet ef migrations add InitialCreate \
  --project        src/Infrastructure/Enterprise.Platform.Infrastructure \
  --startup-project src/Infrastructure/Enterprise.Platform.Infrastructure \
  --context        AppDbContext \
  --output-dir     Persistence/App/Migrations
```

The startup project is the Infrastructure project itself because of the
`AppDbContextDesignTimeFactory` — that bypasses `Program.cs` (and the
Key Vault / OpenTelemetry bootstrap that's hostile to the EF tools) by
constructing the context directly from `appsettings.Development.json`.

Generated files trip a bunch of analyzers on first scaffold (CA1861 constant
arrays, CA2007 ConfigureAwait, CA1707 underscores in timestamped class names).
Adding a `.editorconfig` *inside the Migrations folder* silences the
generator-specific rules without weakening the rest of the codebase.

---

## 4. Pipeline behaviours active on every command

Order matters — the dispatcher composes them outside-in:

1. `LoggingBehavior` — entry / exit / elapsed (LoggerMessage source-gen, CA1848)
2. `ValidationBehavior` — runs the `AbstractValidator<T>` for the command
3. `AuditBehavior` — `IRequiresAudit` only; writes the audit row
4. `CacheInvalidationBehavior` — `ICacheRegionInvalidating` only; wipes regions
5. `TransactionBehavior` — opens a UoW, flushes on success, rolls back on failure
6. `IdempotencyBehavior` — `IIdempotent` only; dedupes by client-supplied key

Queries skip Audit + Transaction + Idempotency by virtue of not implementing
those marker interfaces, and pick up `CachingBehavior` (read-side) when they
implement `ICacheable`.

---

## 5. How to add a new aggregate

Follow this checklist. Every step is enforced by either a test, an analyzer,
or convention failure visible at code review.

1. **Domain**
   - [ ] Create `Aggregates/<Plural>/<Singular>.cs` inheriting `AggregateRoot`.
   - [ ] Sealed; private parameterless ctor for EF; static `Create`/`Register` factory.
   - [ ] Every state-change method raises a matching event.
   - [ ] Create the events as records implementing `IDomainEvent` under `Aggregates/<Plural>/Events/`.
   - [ ] Define `I<Singular>Repository` next to the aggregate. **No** `SaveChangesAsync`.
   - [ ] If you introduce a new value object, put it under `ValueObjects/`. Return `Result<T>` from the factory.

2. **Infrastructure**
   - [ ] Add `Persistence/App/Configurations/<Singular>Configuration.cs`. Use `OwnsOne` + explicit column names for VOs. `Ignore(DomainEvents)`.
   - [ ] Add `Persistence/App/Repositories/<Singular>Repository.cs`. Watch for namespace collisions (Email ⇒ `DomainEmail` alias).
   - [ ] Wire `services.AddScoped<I<Singular>Repository, <Singular>Repository>()` in `AppServiceCollectionExtensions`.
   - [ ] Add a `DbSet<T>` on `AppDbContext`.

3. **Application — write side**
   - [ ] One file per command under `Features/<Plural>/Commands/<Verb><Singular>.cs` containing `record + Validator + Handler`.
   - [ ] Implement the right marker interfaces: `IRequiresAudit` (always), `IIdempotent` (mutations only), `ICacheRegionInvalidating` (mutations that break a cached read).
   - [ ] FluentValidation rules cover input shape; domain invariants stay in the aggregate.

4. **Application — read side**
   - [ ] Define `I<Singular>ReadProjection` in `Abstractions/Persistence/`. Return DTOs / `PagedResult<DTO>`. **No** EF references.
   - [ ] Implement in `Infrastructure/Persistence/App/Projections/<Singular>ReadProjection.cs`. EF code lives here.
   - [ ] One file per query under `Features/<Plural>/Queries/`. Handler delegates to the projection.
   - [ ] Implement `ICacheable` if the read is hot. Cache key encodes every input.

5. **API**
   - [ ] One file under `Endpoints/v1/<Plural>/<Singular>Endpoints.cs` exposing `Map<Singular>Endpoints()`.
   - [ ] Mount via `MapPlatformApiV1Group().MapGroup("/<plural>").RequireAuthorization()`.
   - [ ] Wire the `Map<Singular>Endpoints()` call in `WebApplicationExtensions.UsePlatformPipeline`.

6. **Migration**
   - [ ] `dotnet ef migrations add Add<Singular>` from the repo root using the command in §3.10.
   - [ ] Inspect the generated `Up`/`Down`. The `.editorconfig` already silences scaffold noise.

7. **Verify**
   - [ ] `dotnet build Enterprise.Platform.slnx` — must end with `0 Warning(s) 0 Error(s)`.
   - [ ] `dotnet test tests/Enterprise.Platform.Domain.Tests` (write a small invariant test for the aggregate).
   - [ ] `dotnet test tests/Enterprise.Platform.Architecture.Tests` — catches naming + dependency drift.

---

## 6. Things this work uncovered (worth knowing)

- **`sealed` + `protected` ctor → CS0628.** EF's reflection materialiser is happy
  with a `private` ctor; pick `private` over un-sealing the class.
- **`Microsoft.EntityFrameworkCore` is namespace-banned** outside
  `Application.Abstractions.Persistence`. The architecture test catches it; the
  fix is the projection-interface pattern in §3.7, not a suppression.
- **Generic types' `Type.Name` keeps the arity backtick** (`LoggingBehavior\`2`).
  `HaveNameEndingWith("Behavior")` fails for open generics. Use
  `HaveNameMatching(@"Behavior(\`\d+)?$")`. Existing test fixed in this round.
- **Migration files trip analyzer rules out of the box.** Add a folder-scoped
  `.editorconfig` listing the offenders rather than weakening project-wide
  rules.
- **DtoGen `Program.cs` was missing `ConfigureAwait`** (CA2007). Pre-existing
  drift caught by this round's full sweep — fixed.
- **Stale `EventShopper*Tests.cs`** survived the Phase-1 rip-out and only
  surfaced when we attempted a full-solution build. Deleted. *Lesson:* after a
  large-area delete, run a full-solution build before declaring victory, not
  just the projects you touched.

---

## 7. Verification snapshot (the run that closed this task)

```text
$ dotnet build Enterprise.Platform.slnx --nologo -v minimal
... 14 projects ...
Build succeeded.
    0 Warning(s)
    0 Error(s)

$ dotnet test tests/Enterprise.Platform.Domain.Tests        → 59 / 59
$ dotnet test tests/Enterprise.Platform.Application.Tests   →  3 /  3
$ dotnet test tests/Enterprise.Platform.Infrastructure.Tests →  1 /  1
$ dotnet test tests/Enterprise.Platform.Architecture.Tests  → 12 / 12

EF migration: 20260426040024_InitialCreate
   Tables : Users, PlatformOutboxMessages
   Indexes: IX_Users_Email (unique)
            IX_Users_ExternalIdentityId (unique, filtered NOT NULL)
            IX_PlatformOutboxMessages_PublishedAt_NextAttemptAt
```

`Api.Tests` deliberately not run — WDAC on the dev box blocks
`WebApplicationFactory`-based hosts (see memory `feedback_wdac_blocks_runtime.md`).
The CI pipeline runs them separately.
