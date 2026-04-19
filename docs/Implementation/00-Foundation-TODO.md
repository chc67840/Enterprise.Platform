# Enterprise.Platform — Foundation Implementation TODO

> **Living document.** Update checkboxes in place as work progresses. Commit with code changes so the doc stays in sync.
>
> **Target:** .NET 10 + Clean Architecture + CQRS + DDD, multi-database (start MSSQL → PostgreSQL later).
> **Initial domain DB:** `EventShopperDb` (MSSQL, DB-first).

---

## Status Legend

| Symbol | Meaning |
|:---:|---|
| `[ ]` | Pending — not started |
| `[~]` | In progress |
| `[x]` | Complete (build + smoke test green) |
| `[!]` | Blocked — needs a decision or external input |
| `[–]` | Deferred / descoped — with rationale in Notes |

---

## Design Decisions — **LOCKED 2026-04-17**

| ID | Decision | Choice | Rationale / Notes |
|:---:|---|:---:|---|
| **D1** | Where DB-first scaffolded entities live | **A** | `Infrastructure/Persistence/EventShopper/Entities/` — keeps Domain clean (zero NuGet). Domain grows organically as real business rules surface. |
| **D2** | DTO generation + mapping approach | **B** | Mapster + `tools/Enterprise.Platform.DtoGen/` codegen. DtoGen emits `{Entity}Dto.cs` into Contracts AND the matching `TypeAdapterConfig` registration into Infrastructure as a matched pair. Zero per-entity boilerplate; re-runnable after every re-scaffold. |
| **D3** | Multi-database design | **A** | One `DbContext` per logical database (e.g. `PlatformDbContext`, `EventShopperDbContext`, future `ReportsPostgresDbContext`). `IDbContextFactory` routes by logical name. Each context owns its migrations and provider. |
| **D4** | Platform identity/control-plane DB | **A (deferred)** | Separate `PlatformDb` (code-first) remains the *target architecture* for `User`/`Role`/`Tenant`/`AuditLog`/`OutboxMessage`. **Implementation deferred 2026-04-17** — we're focusing on EventShopperDb (DB-first, MSSQL) first; PlatformDb wiring + platform entities will be picked up as a later phase. Items that depend on PlatformDb are marked `[–]` below. |
| **D5** | Execution cadence | **A** | Phase-by-phase with an explicit build checkpoint after each phase. Catches drift early. |

---

## Phase 0 — Prep (blocked by D1–D5)

**Goal:** developer-box ready to scaffold and build.

- [x] **0.1** Added `ConnectionStrings:EventShopperDb` + `DatabaseSettings` section to `appsettings.Development.json` in **Api** and **Worker** only (BFF excluded by design). `Application Name` normalized to `Enterprise.Platform` / `Enterprise.Platform.Worker` so SQL Server audit logs identify the caller.
- [–] **0.2** ~~Add `ConnectionStrings:PlatformDb`~~ — **deferred** with D4
- [x] **0.3** `Contracts/Settings/DatabaseSettings.cs` — `DatabaseSettings { DefaultConnection, Connections }` + `DatabaseConnectionSettings { ConnectionStringName, Provider, CommandTimeoutSeconds, IsReadReplica, EnableSensitiveDataLogging, EnableDetailedErrors }` + `DatabaseProvider` enum (SqlServer / PostgreSql / InMemory).
- [x] **0.4** `tools/Enterprise.Platform.DtoGen/` created (net10.0 console, `IsPackable=false`, `IsPublishable=false`, added to `.slnx` under `/tools/`). Ships CLI skeleton (`Program.cs` + `CommandLine.cs`) — generator body lands in Phase 6.
- [x] **0.5** `.config/dotnet-tools.json` tool manifest created; `dotnet-ef` 10.0.0 installed as local tool (`dotnet ef --version` → `10.0.0`). Reproducible on any clean checkout via `dotnet tool restore`.
- [x] **0.6** `Mapster` 7.4.0 + `Mapster.DependencyInjection` 1.0.1 registered in `Directory.Packages.props` (and mirrored in `Docs/Scripts/master-script.md`). No csproj references yet — those land with the first handler/projection in Phase 4+.
- [x] **Checkpoint 0:** `dotnet build` → 0 warnings / 0 errors; `dotnet ef --version` → 10.0.0; `dotnet run --project tools/Enterprise.Platform.DtoGen -- --help` renders usage cleanly.

---

## Phase 1 — Shared (leaf, zero deps)

**Project:** `src/Contracts/Enterprise.Platform.Shared/`

### 1.1 Results
- [x] `Results/Error.cs` — `Error(Code, Message, Severity)` record + factory helpers (`Validation`, `NotFound`, `Conflict`, `Unauthorized`, `Forbidden`, `Internal`) + `ErrorSeverity` enum + `Error.None` sentinel
- [x] `Results/ErrorCodes.cs` — `EP.*` prefixed constants (`Validation`, `NotFound`, `Conflict`, `Forbidden`, `Unauthorized`, `Internal`)
- [x] `Results/Result.cs` — `Result` + `Result<T>` with `Success`/`Failure`, `IsSuccess`/`IsFailure`, `Value`, `Error`, implicit conversions from `T` and `Error`, invariant-protected constructor

### 1.2 Guards
- [x] `Guards/Guard.cs` — `IGuardClause` marker + `Guard.Against` singleton + extension methods (`Null`, `NullOrEmpty` (string/collection), `NullOrWhiteSpace`, `OutOfRange`, `NegativeOrZero`, `InvalidFormat` with 1-sec regex timeout). Extension-method shape lets Domain/Application add their own guards without touching Shared.

### 1.3 Constants
- [x] `Constants/AppConstants.cs` — nested `StringLengths` / `Paging` / `Timeouts` / `Auth` static classes
- [x] `Constants/HttpHeaderNames.cs` — `X-Correlation-ID`, `X-Tenant-ID`, `X-Idempotency-Key`, `X-API-Version`, `X-Request-ID`
- [x] `Constants/ClaimTypes.cs` — `ep:user_id`, `ep:tenant_id`, `ep:permission`, `ep:role`, `ep:session_id`

### 1.4 Extensions
- [x] `Extensions/StringExtensions.cs` — `Truncate(maxLength, ellipsis)`, `ToSlug` (diacritic-stripped, URL-safe), `ToMask(prefix, suffix, maskChar)` for PII-safe logging
- [x] `Extensions/DateTimeExtensions.cs` — `ToUtcIso8601`, `StartOfDay`, `EndOfDay` (full-day end via `AddTicks(-1)` to avoid off-by-one), `IsBetween`
- [x] `Extensions/EnumerableExtensions.cs` — `ForEach`, `ChunkBy` (named wrapper over `Enumerable.Chunk`), `OrEmpty` (`DistinctBy` skipped — already in BCL since .NET 6)

### 1.5 Enumerations
- [x] `Enumerations/SortDirection.cs` — `Asc`, `Desc`
- [x] `Enumerations/FilterOperator.cs` — `Eq`, `Neq`, `Gt`, `Gte`, `Lt`, `Lte`, `Like`, `In`, `Between`
- [x] `Enumerations/TenantIsolationMode.cs` — `SharedDatabase`, `SchemaPerTenant`, `DatabasePerTenant`

- [x] **Checkpoint 1:** `dotnet build src/Contracts/Enterprise.Platform.Shared` → 0 warnings, 0 errors. Full-solution `dotnet build` also green.

---

## Phase 2 — Contracts

**Project:** `src/Contracts/Enterprise.Platform.Contracts/`

### 2.1 Settings POCOs
- [x] `Settings/AppSettings.cs` — Name / Environment / Version / Description / DeveloperMode + `SectionName = "App"`
- [x] `Settings/JwtSettings.cs` — Issuer, Audience, SigningKey, AccessTokenLifetime (15m), RefreshTokenLifetime (14d), ClockSkew (30s), RotateRefreshTokens (true)
- [x] `Settings/CorsSettings.cs` — AllowedOrigins / AllowedMethods / AllowedHeaders / ExposedHeaders / AllowCredentials / PreflightMaxAge
- [x] `Settings/RateLimitSettings.cs` — Global / PerTenant / PerUser permits-per-window + Window + QueueLimit + EmitRetryAfterHeader
- [x] `Settings/CacheSettings.cs` — `CacheProvider` enum (InMemory / Redis) + RedisConnectionString + KeyPrefix + DefaultTtl + `Dictionary<string,TimeSpan>` Regions
- [x] `Settings/AzureSettings.cs` — KeyVaultUri / BlobAccount / AppConfigEndpoint / ManagedIdentityClientId
- [x] `Settings/MultiTenancySettings.cs` — `TenantIsolationMode` (reused from Shared) + new `TenantResolutionStrategy` enum (Claim / Header / Subdomain / RouteSegment) + DefaultTenantId + RequireResolvedTenant
- [x] `Settings/ObservabilitySettings.cs` — ServiceName / ServiceVersion / OtelEndpoint / SamplingRatio / EnableDatabaseInstrumentation / EnableHttpInstrumentation / SeqEndpoint
- [x] `Settings/DatabaseSettings.cs` — **landed in Phase 0.3** (Dictionary<string, DatabaseConnectionSettings> + DatabaseProvider enum). Kept as-is; no changes needed.

### 2.2 Responses
- [x] `Responses/ApiResponse.cs` — generic `ApiResponse<T>` envelope (Data / Success / Meta / Warnings) + non-generic `ApiResponse.Ok<T>(data, meta, warnings)` factory (hosts the factory on the non-generic type to satisfy CA1000) + `ResponseMeta` (CorrelationId, TenantId, ServerTime, ApiVersion, Pagination) + `PaginationMeta` (supports both offset and cursor shapes).
- [x] `Responses/ProblemDetailsExtended.cs` — RFC 7807 base (Type / Title / Status / Detail / Instance) + platform extensions (CorrelationId / TenantId / Errors `IReadOnlyList<Error>` / `FieldErrors` dictionary / Timestamp).

### 2.3 Core Requests (platform) — **[–] deferred with D4**
- [–] `Requests/LoginRequest.cs`
- [–] `Requests/RefreshTokenRequest.cs`
- [–] `Requests/CreateTenantRequest.cs`
- [–] `Requests/RegisterUserRequest.cs`

> Request DTOs for the platform-identity surface (login, refresh, tenant create, user register) depend on PlatformDb going live. Deferred to stay consistent with **D4** — we don't want contract stubs for a subsystem we're not about to wire. They'll land when PlatformDb is revisited.

### 2.4 Core DTOs (platform) — **[–] deferred with D4**
- [–] `DTOs/UserDto.cs`
- [–] `DTOs/RoleDto.cs`
- [–] `DTOs/TenantDto.cs`
- [–] `DTOs/AuditLogDto.cs`

> Same rationale as 2.3. These DTOs belong to the PlatformDb entities and will be generated (or hand-written, TBD at the time) alongside the platform migration.

> **EventShopper DTOs are generated in Phase 6.** Do not hand-write them here.

- [x] **Checkpoint 2:** `dotnet build src/Contracts/Enterprise.Platform.Contracts` green (0 warnings / 0 errors); full-solution build also green.

---

## Phase 3 — Domain (zero NuGet, only references Shared)

**Project:** `src/Core/Enterprise.Platform.Domain/`

### 3.1 Marker interfaces
- [x] `Interfaces/IAuditableEntity.cs` — `CreatedBy` / `CreatedAt` / `ModifiedBy?` / `ModifiedAt?` (all get+set; populated by `AuditableEntityInterceptor`)
- [x] `Interfaces/ISoftDeletable.cs` — `IsDeleted` / `DeletedAt?` / `DeletedBy?`
- [x] `Interfaces/ITenantEntity.cs` — `TenantId : Guid`

### 3.2 Base classes
- [x] `Entities/BaseEntity.cs` — `Guid Id { get; protected set; }` (protected so EF reflection works, no public reassignment), `byte[] RowVersion`, `IEquatable<BaseEntity>` equality by `(ConcreteType, Id)`, `==` / `!=` operators
- [x] `Entities/AuditableEntity.cs` — abstract `: BaseEntity, IAuditableEntity`
- [x] `Entities/TenantAuditableEntity.cs` — abstract `: AuditableEntity, ITenantEntity`
- [x] `Aggregates/AggregateRoot.cs` — abstract `: TenantAuditableEntity`. `private readonly List<IDomainEvent> _domainEvents`, exposes `IReadOnlyCollection<IDomainEvent> DomainEvents`. `AddDomainEvent` is **protected** (only aggregate raises its own events); `ClearDomainEvents` is **public** (dispatcher drains).

### 3.3 Events
- [x] `Events/IDomainEvent.cs` — `DateTimeOffset OccurredOn { get; }`
- [x] `Events/IIntegrationEvent.cs` — `Guid EventId`, `DateTimeOffset OccurredOn`, `string EventType` (versioned like `"UserRegistered.v1"` for schema evolution)

### 3.4 Value Objects
- [x] `ValueObjects/ValueObject.cs` — abstract; `GetEqualityComponents()` drives `Equals` / `GetHashCode` / operators. Reference type (not struct) so nested collections are legal.
- [x] `ValueObjects/Email.cs` — `sealed partial`, `Create(string?)` returns `Result<Email>`, normalized lowercase, `[GeneratedRegex]` with 500ms timeout
- [x] `ValueObjects/PhoneNumber.cs` — E.164-normalized (`^\+[1-9][0-9]{7,14}$`); strips whitespace/hyphens/parens before validating; `Create` → `Result<PhoneNumber>`
- [x] `ValueObjects/Money.cs` — `Amount (decimal) + Currency (ISO 4217, upper-cased)`; `Add` / `Subtract` / `Multiply`; `EnsureSameCurrency` throws — mid-calc conversion is a policy decision that belongs in a service
- [x] `ValueObjects/Address.cs` — Street / City / Region? / PostalCode / Country (ISO 3166-1 alpha-2); `Create` → `Result<Address>`
- [x] `ValueObjects/DateRange.cs` — `Start <= End` invariant enforced by `Create`; `Contains(instant)`, `Overlaps(other)`, `Duration`

### 3.5 Enumerations
- [x] `Enumerations/Enumeration.cs` — smart-enum base; `Id` + `Name`; `GetAll<T>()`, `FromId<T>(id)`, `FromName<T>(name)` via reflection; `IComparable` + `IEquatable` + full operator set (`==` / `!=` / `<` / `<=` / `>` / `>=`)

### 3.6 Exceptions
- [x] `Exceptions/DomainException.cs` — abstract base, `ErrorCode` property set via ctor, two ctors (message / message+inner)
- [x] `Exceptions/EntityNotFoundException.cs` — `ErrorCodes.NotFound`; convenience ctor `(entityName, key)`
- [x] `Exceptions/BusinessRuleViolationException.cs` — `ErrorCodes.Conflict`
- [x] `Exceptions/ConcurrencyConflictException.cs` — `ErrorCodes.Conflict`; convenience ctor `(entityName, key)` → "modified by another process" message
- [x] `Exceptions/AccessDeniedException.cs` — `ErrorCodes.Forbidden`; static factory `ForPermission(string)`
- [x] `Exceptions/TenantMismatchException.cs` — `ErrorCodes.Forbidden`; convenience ctor `(expectedTenantId, actualTenantId)`

### 3.7 Specifications
- [x] `Specifications/ISpecification.cs` — `Criteria` / `Includes` / `IncludeStrings` / `OrderBy` / `OrderByDescending` / `Skip` / `Take` / `IsPagingEnabled` / `AsNoTracking` / `AsSplitQuery` (last one added beyond the TODO — needed for include-heavy specs to avoid cartesian explosions)
- [x] `Specifications/Specification.cs` — protected `SetCriteria` / `AddInclude` / `ApplyPaging` / `ApplyOrderBy` / `ApplyOrderByDescending` / `UseNoTracking` / `UseSplitQuery`

### 3.8 Abstractions (implemented by Infrastructure)
- [x] `Interfaces/IGenericRepository.cs` — `GetByIdAsync`, `GetSingleOrDefaultAsync`, `ListAsync`, `CountAsync`, `AnyAsync`, `AddAsync` / `AddRangeAsync`, `Update`, `Remove` / `RemoveRange`
- [x] `Interfaces/IUnitOfWork.cs` — `: IAsyncDisposable`; `SaveChangesAsync`, `Begin/Commit/RollbackTransactionAsync`
- [x] `Interfaces/IReadDbContext.cs` — `IQueryable<T> Set<T>() where T : class` (implementation globally `AsNoTracking`)
- [x] `Interfaces/IWriteDbContext.cs` — **EF-free**: only `SaveChangesAsync`. No `DbSet<T>` surface on Domain.
- [x] `Interfaces/ICurrentUserService.cs` — `UserId?`, `Email?`, `IsAuthenticated`, `HasPermission(string)`, `IsInRole(string)`
- [x] `Interfaces/ICurrentTenantService.cs` — `TenantId?`, `IsolationMode` (reuses `Shared` enum)
- [x] `Interfaces/IDomainEventDispatcher.cs` — single-event and batch `DispatchAsync` overloads

- [x] **Checkpoint 3:** `dotnet build src/Core/Enterprise.Platform.Domain` green (0 warnings / 0 errors); full-solution build also green. **`dotnet list src/Core/Enterprise.Platform.Domain package` confirms zero NuGet deps** — the D1 invariant holds manually until Phase 12 lands the automated architecture test.

---

## Phase 4 — Application (CQRS skeleton, pipeline behaviors)

**Project:** `src/Core/Enterprise.Platform.Application/`

### 4.1 Messaging abstractions
- [x] `Abstractions/Messaging/ICommand.cs` — `ICommand` (no-payload) + `ICommand<TResult>` (payload-returning); both marker interfaces with `[SuppressMessage("Design","CA1040")]`
- [x] `Abstractions/Messaging/ICommandHandler.cs` — two arities (`ICommandHandler<TCommand>` void + `ICommandHandler<TCommand, TResult>`)
- [x] `Abstractions/Messaging/IQuery.cs` — `IQuery<TResult>` marker
- [x] `Abstractions/Messaging/IQueryHandler.cs` — `IQueryHandler<TQuery, TResult>`
- [x] `Abstractions/Messaging/IDispatcher.cs` — `SendAsync(ICommand)`, `SendAsync<TResult>(ICommand<TResult>)`, `QueryAsync<TResult>(IQuery<TResult>)`

### 4.2 Behavior abstractions (marker interfaces)
- [x] `Abstractions/Behaviors/IPipelineBehavior.cs` — `IPipelineBehavior<in TRequest, TResponse>` + `RequestHandlerDelegate<TResponse>` (CA1711 suppressed inline — naming mirrors MediatR for reader familiarity)
- [x] `Abstractions/Behaviors/ITransactional.cs` — empty marker
- [x] `Abstractions/Behaviors/ICacheable.cs` — exposes `CacheKey` + `Ttl?` + `CacheRegion?` (non-empty, caller contributes deterministic key)
- [x] `Abstractions/Behaviors/IRequiresAudit.cs` — `AuditAction` + `AuditSubject?`
- [x] `Abstractions/Behaviors/IIdempotent.cs` — `IdempotencyKey` + `IdempotencyWindow` (default 24h)
- [x] `Abstractions/Behaviors/IRequiresDualApproval.cs` — empty marker; workflow lands later

### 4.3 Persistence abstraction (for Dapper-style raw read path)
- [x] `Abstractions/Persistence/IDbConnectionFactory.cs` — `CreateConnectionAsync(logicalName)` returning `DbConnection`

### 4.4 Dispatcher
- [x] `Dispatcher/Dispatcher.cs` — lightweight mediator. Single reflection hop to re-enter a strongly-typed generic method (`SendInternalAsync<TCommand,TResult>` etc.), then a typed delegate chain builds bottom-up from behaviors + handler. Also defines `Unit` struct for the void command path. Hot-path delegate caching is a future optimization.

### 4.5 Common services
- [x] `Common/Interfaces/IDateTimeProvider.cs` — `UtcNow`, `Today`
- [x] `Common/Interfaces/IFileStorageService.cs` — `UploadAsync`, `DownloadAsync`, `DeleteAsync`, `GetPresignedUrlAsync`
- [x] `Common/Interfaces/IEmailService.cs` — `SendAsync(EmailMessage)` + `EmailMessage` record (To/Cc/Bcc/Subject/Body/IsHtml/TemplateId/TemplateData)
- [x] `Common/Interfaces/INotificationService.cs` — `NotifyAsync` + `NotificationChannel` enum (InApp/Email/Sms/Push)
- [+] `Common/Interfaces/IAuditWriter.cs` — **beyond original TODO**; `WriteAsync(AuditEntry)` + `AuditEntry` record. Required by `AuditBehavior`.
- [+] `Common/Interfaces/IIdempotencyStore.cs` — **beyond original TODO**; `TryGetAsync<T>` + `SetAsync<T>(ttl)`. Required by `IdempotencyBehavior`.

### 4.6 Common models
- [x] `Common/Models/PagedRequest.cs` — offset pagination with property-setter clamping to `AppConstants.Paging.MaxPageSize`
- [x] `Common/Models/CursorPagedRequest.cs` — opaque cursor + clamped page size
- [x] `Common/Models/PagedResult.cs` — `Items` + `TotalCount?` + derived `TotalPages`
- [x] `Common/Models/CursorPagedResult.cs` — `Items` + `NextCursor?` + `PreviousCursor?`
- [x] `Common/Models/SortDescriptor.cs` — `Field` + `Direction` (reuses `SortDirection` from Shared)
- [x] `Common/Models/FilterDescriptor.cs` — `Field` + `Operator` (reuses `FilterOperator`) + `Value`

### 4.7 Common extensions
- [x] `Common/Extensions/QueryableExtensions.cs` — `ApplyPaging`, `ApplySorting` (OrderBy → ThenBy chain), `ApplyFilters` (expression-tree translator supporting Eq / Neq / Gt / Gte / Lt / Lte / Like / In / Between); throws `NotSupportedException` for unknown operators
- [x] `Common/Extensions/StringExtensions.cs` — `ToSha256Hex` (cache/idempotency key building), `ToInvariantTitleCase`

### 4.8 Mapping contracts
- [–] `Common/Mappings/IMappable.cs` — **deferred/skipped**: D2 = Mapster + DtoGen-emitted `TypeAdapterConfig`s. Per-DTO mapping contract is redundant.

### 4.9 Pipeline behaviors (ordered 1→7)
- [x] `Behaviors/LoggingBehavior.cs` — order 1; structured entry/exit + elapsed; OperationCanceled is re-thrown without logging
- [x] `Behaviors/ValidationBehavior.cs` — order 2; runs every `IValidator<TRequest>` in parallel-ish (sequential for determinism), throws `FluentValidation.ValidationException` with aggregated failures
- [x] `Behaviors/TenantFilterBehavior.cs` — order 3; when `RequireResolvedTenant`+no tenant, throws `TenantMismatchException`
- [x] `Behaviors/AuditBehavior.cs` — order 4; activates only on `IRequiresAudit`; captures success **and** failure paths via try/finally; writer errors are swallowed (audit is best-effort)
- [x] `Behaviors/TransactionBehavior.cs` — order 5; activates only on `ITransactional`; rollback failures log but re-throw the original exception
- [x] `Behaviors/CachingBehavior.cs` — order 6; activates only on `ICacheable` (typically `IQuery`); short-circuits on hit (`next()` never invoked)
- [x] `Behaviors/IdempotencyBehavior.cs` — order 7 innermost; activates only on `IIdempotent`; store key = SHA256(requestType + principalId + suppliedKey)
- [+] `Behaviors/LogMessages.cs` — **beyond TODO**; source-generated `LoggerMessage` extensions for all 10 behavior log sites (CA1848-compliant lazy evaluation)

### 4.10 DI
- [x] `DependencyInjection.cs` — `AddApplication(IServiceCollection, IConfiguration)`: binds `MultiTenancySettings` + `CacheSettings`, registers `Dispatcher` (scoped), the 7 behaviors as open-generic `IPipelineBehavior<,>` in pipeline order, every handler via assembly scan (`ICommandHandler<>`, `ICommandHandler<,>`, `IQueryHandler<,>`), and FluentValidation's `AddValidatorsFromAssembly`.

- [x] **Checkpoint 4:** `dotnet build src/Core/Enterprise.Platform.Application` green (0 warnings / 0 errors); full-solution build also green.

---

## Phase 5 — Infrastructure · Persistence Core (PlatformDb + multi-DB routing)

**Project:** `src/Infrastructure/Enterprise.Platform.Infrastructure/`

### 5.1 DB factory + contexts
- [x] `Application/Abstractions/Persistence/IDbContextFactory.cs` — **lives in Application** per D3; three overloads (`GetContext<T>()` default, `GetContext<T>(logicalName)`, `GetContext(logicalName)` non-generic). Application.csproj now references `Microsoft.EntityFrameworkCore` (abstraction only; concrete provider stays in Infrastructure).
- [x] `Infra/Persistence/DbContextFactory.cs` — resolves via `IServiceProvider` + `DbContextRegistry`; throws `InvalidOperationException` when a name is unregistered or the registered type isn't assignable to the requested type.
- [+] `Infra/Persistence/DbContextRegistry.cs` — **beyond TODO**; singleton holding `Dictionary<logicalName, Type>` populated by DI (`RegisterDbContext<T>(name, isDefault)`). Tracks `DefaultLogicalName` for the no-arg `GetContext<T>()` overload.
- [–] `Persistence/Platform/PlatformWriteDbContext.cs` — deferred with D4
- [–] `Persistence/Platform/PlatformReadDbContext.cs` — deferred with D4
- [x] `Infra/Persistence/UnitOfWork.cs` — `UnitOfWork<TContext> : IUnitOfWork` scoped per request; nested `BeginTransaction` calls are no-ops (first caller owns).
- [x] `Infra/Persistence/GenericRepository.cs` — `GenericRepository<T> : IGenericRepository<T> where T : BaseEntity`; constructor takes `DbContext` directly (resolved per scope). Overridable via `virtual`.
- [+] `Infra/Persistence/SpecificationEvaluator.cs` — **beyond TODO**; static helper translating `ISpecification<T>` to `IQueryable<T>` (order: NoTracking → SplitQuery → criteria → includes → sort → paging). Necessary infrastructure for `GenericRepository.ApplySpecification`.
- [x] `Infra/Persistence/DbConnectionFactory.cs` — reads `DatabaseSettings` via `IOptionsMonitor`, resolves connection string via `IConfiguration.GetConnectionString(...)` so user-secrets / Key Vault overrides flow through. SqlServer wired; PostgreSQL / InMemory throw `NotSupportedException` until wired in later phases.

### 5.2 Interceptors
- [x] `Infra/Persistence/Interceptors/AuditableEntityInterceptor.cs` — on Added: stamps CreatedAt/By + clears Modified; on Modified: stamps ModifiedAt/By + pins CreatedAt/By as non-modified so they can't be overwritten. Anonymous actor reported as `"system"`.
- [x] `Infra/Persistence/Interceptors/SoftDeleteInterceptor.cs` — flips `EntityState.Deleted` → `Modified` + stamps `IsDeleted/DeletedAt/DeletedBy` for `ISoftDeletable` entities.
- [x] `Infra/Persistence/Interceptors/TenantQueryFilterInterceptor.cs` — write-side tenant stamping + cross-tenant modify guard; throws `TenantMismatchException` on mismatch. (Name kept for TODO parity; it's strictly a SaveChanges interceptor — read-side filtering is done via `HasQueryFilter` at context config time.)
- [x] `Infra/Persistence/Interceptors/DomainEventDispatchInterceptor.cs` — drains `AggregateRoot.DomainEvents` **after** a successful `SaveChanges` (handlers observe committed state). Events are cleared *before* dispatch so re-entrant saves don't re-emit. Sync `SavedChanges` path unwraps via `Task.Run` to avoid sync-context deadlocks.

### 5.3 EF Fluent configurations (platform entities) — **[–] deferred with D4**
- [–] `Persistence/Platform/Configurations/UserConfiguration.cs`
- [–] `Persistence/Platform/Configurations/RoleConfiguration.cs`
- [–] `Persistence/Platform/Configurations/TenantConfiguration.cs`
- [–] `Persistence/Platform/Configurations/AuditLogConfiguration.cs`
- [–] `Persistence/Platform/Configurations/OutboxMessageConfiguration.cs`

### 5.4 Platform entities (code-first) — **[–] deferred with D4**
- [–] `Persistence/Platform/Entities/User.cs`
- [–] `Persistence/Platform/Entities/Role.cs`
- [–] `Persistence/Platform/Entities/Tenant.cs`
- [–] `Persistence/Platform/Entities/AuditLog.cs`
- [–] `Persistence/Platform/Entities/OutboxMessage.cs`

### 5.5 Seeding — **[–] deferred with D4**
- [–] `Persistence/Seeding/ISeedData.cs`
- [–] `Persistence/Seeding/RoleSeedData.cs`
- [–] `Persistence/Seeding/DefaultTenantSeedData.cs`

### 5.6 Initial migration — **[–] deferred with D4**
- [–] `dotnet ef migrations add InitialCreate --context PlatformWriteDbContext`
- [–] `dotnet ef database update --context PlatformWriteDbContext` against PlatformDb

### 5.7 Common services (beyond original TODO) — needed for interceptors to wire
- [+] `Infra/Common/SystemDateTimeProvider.cs` — default `IDateTimeProvider` impl; thin wrapper over `DateTimeOffset.UtcNow`. Registered as singleton in `AddInfrastructure`.

### 5.8 DI composition root
- [x] `Infra/DependencyInjection.cs` — `AddInfrastructure(services, config)` binds `DatabaseSettings`, registers `SystemDateTimeProvider`, `DbContextRegistry`, `DbContextFactory`, `DbConnectionFactory`, open-generic `UnitOfWork<>` + `GenericRepository<>`, and all 4 interceptors as transient. Extension `RegisterDbContext<TContext>(logicalName, isDefault)` populates the registry — callers chain it after `AddDbContext<TContext>`.

- [x] **Checkpoint 5:** `dotnet build src/Infrastructure/Enterprise.Platform.Infrastructure` green after SDK reinstall (0 warnings / 0 errors); full-solution build also green. Platform-specific items in 5.6 stay `[–]` per D4.

---

## Phase 6 — DB-first scaffold · EventShopperDb (MSSQL)

### 6.1 Verify connectivity
- [x] `sqlcmd -S localhost -E -Q "SELECT @@VERSION"` → SQL Server 2025 Standard Developer Edition reachable; `EventShopperDb` present with 41 tables.

### 6.2 Scaffold EF context + entities
- [x] `dotnet ef dbcontext scaffold "..." Microsoft.EntityFrameworkCore.SqlServer --project Infrastructure --startup-project Api --context EventShopperDbContext --context-dir Persistence/EventShopper/Contexts --output-dir Persistence/EventShopper/Entities --no-onconfiguring --no-pluralize --use-database-names --force` — produced 39 entity POCOs + `EventShopperDbContext.cs` (785-line Fluent `OnModelCreating`).
- [x] **Pre-req landed:** `Microsoft.EntityFrameworkCore.Design` added to **Api** csproj with `PrivateAssets=all` (dotnet-ef requires it on the startup project).
- [x] Entities + context compile clean under `TreatWarningsAsErrors=true`.

### 6.3 Refactor scaffolded artifacts
- [–] **Intentionally skipped** — per-entity config extraction would be clobbered on every re-scaffold with `--force`. Keeping scaffold output as a regenerable artifact; customizations (query filters, interceptor attach) land in a separate partial/extension file if/when needed.
- [x] Scaffold uses Fluent API by default (no `--data-annotations` flag) — no DataAnnotations to strip.
- [x] `partial class` is the scaffolder's default as of EF Core 10.

### 6.4 Run DtoGen tool
- [+] **Generator body built from scratch** (`tools/Enterprise.Platform.DtoGen/Generator.cs`, ~247 lines) using Roslyn syntax parsing (`Microsoft.CodeAnalysis.CSharp` added to CPM). Two-pass: inventory entity class names → emit DTOs + registry. Skip rule for nav properties: `virtual` keyword (fast) + defensive type-name match.
- [+] Generator emits `// <auto-generated>` banner + **`#nullable enable`** directive — without the latter, NRT annotations on DTOs hit CS8669 inside an auto-generated context.
- [+] Registry file name derived from the mapping namespace's penultimate segment (`...EventShopper.Mappings` → `EventShopperMappingRegistry`).
- [x] `dotnet run --project tools/Enterprise.Platform.DtoGen -- ...` → **39 DTOs + 1 mapping registry** emitted. Bi-directional `TypeAdapterConfig<Entity, EntityDto>` + `<EntityDto, Entity>` per pair.
- [x] D2 satisfied: `EventShopperMappingRegistry : IRegister` registers all 78 `NewConfig` bindings.

### 6.5 Register EventShopperDbContext with the factory
- [x] `Infra/Persistence/EventShopper/EventShopperServiceCollectionExtensions.cs` — `AddEventShopperDb(services, config)` wires: `AddDbContext<EventShopperDbContext>` (SqlServer + `EnableRetryOnFailure`) + `RegisterDbContext<EventShopperDbContext>("EventShopper", isDefault: true)` + `AddScoped<IUnitOfWork, UnitOfWork<EventShopperDbContext>>` (the closed form the Phase-5 registration was waiting for) + Mapster (`TypeAdapterConfig` singleton scanning the registry + `IMapper → ServiceMapper` scoped).
- [x] **Interceptor attachment deliberately deferred to Phase 7** — the 4 interceptors depend on `ICurrentUserService` / `ICurrentTenantService` / `IDomainEventDispatcher` whose impls haven't landed. Attaching now would break DI. EventShopperDb entities are raw DB-first POCOs that don't implement the audit/tenant markers anyway.
- [x] **CPM additions:** `Microsoft.CodeAnalysis.CSharp` (DtoGen), `Microsoft.Extensions.Configuration` / `.Configuration.Json` / `.DependencyInjection` (test-side). Infrastructure.csproj gained direct `Mapster` + `Mapster.DependencyInjection` refs.

### 6.6 Smoke test
- [x] `tests/Enterprise.Platform.Infrastructure.Tests/Persistence/EventShopperDbContextSmokeTests.cs` — two xUnit `[Fact]`s: (a) `Integration`-tagged test builds a minimal `ServiceCollection`, resolves `IDbContextFactory`, fetches `EventShopperDbContext`, runs `context.Roles.AsNoTracking().Take(1).ToListAsync()` against the live DB; (b) `Unit`-tagged test asserts `DbContextRegistry.DefaultLogicalName == "EventShopper"` after `AddEventShopperDb`.
- [x] **No EF migrations attempted** — `EnableRetryOnFailure` is the only provider config; no `Database.Migrate()` / `EnsureCreated()` code path.
- [x] **CA1707** (xUnit `Given_When_Then` naming) suppressed per-project in `Enterprise.Platform.Infrastructure.Tests.csproj`.

- [x] **Checkpoint 6:** `dotnet build` (full solution) green — 0 warnings / 0 errors. `dotnet test tests/Enterprise.Platform.Infrastructure.Tests` → **3/3 passed** (including the live-DB round-trip).

---

## Phase 7 — Infrastructure · Cross-cutting services

### 7.1 Identity
- [ ] `Identity/OAuth/OAuthConfiguration.cs`
- [ ] `Identity/OAuth/TokenService.cs` (JWT issue + refresh rotation)
- [ ] `Identity/OAuth/RefreshTokenCleanupJob.cs`
- [ ] `Identity/Authorization/PermissionAuthorizationHandler.cs`
- [ ] `Identity/Authorization/RbacPolicyProvider.cs`
- [ ] `Identity/Authorization/AbacPolicyEvaluator.cs` _(commented scaffold)_
- [ ] `Identity/Authorization/ResourceOwnershipHandler.cs`
- [ ] `Identity/Services/CurrentUserService.cs`
- [ ] `Identity/Services/CurrentTenantService.cs`
- [ ] `Identity/Services/LoginProtectionService.cs`

### 7.2 Caching
- [ ] `Caching/InMemoryCacheProvider.cs` _(active)_
- [ ] `Caching/RedisCacheProvider.cs` _(commented stub)_
- [ ] `Caching/CacheKeys.cs`
- [ ] `Caching/CacheInvalidationService.cs`

### 7.3 Messaging
- [ ] `Messaging/Outbox/OutboxProcessor.cs`
- [ ] `Messaging/Outbox/OutboxCleanupJob.cs`
- [ ] `Messaging/DomainEvents/DomainEventDispatcher.cs`
- [ ] `Messaging/IntegrationEvents/IntegrationEventPublisher.cs` _(commented stub)_

### 7.4 Resilience
- [ ] `Resilience/ResiliencePipelineSetup.cs` (retry + circuit breaker + timeout)
- [ ] `Resilience/HttpClientResilienceSetup.cs`

### 7.5 Observability
- [ ] `Observability/OpenTelemetrySetup.cs`
- [ ] `Observability/StructuredLoggingSetup.cs` (Serilog)
- [ ] `Observability/BusinessMetrics.cs`
- [ ] `Observability/PiiScrubber.cs`

### 7.6 Security
- [ ] `Security/DataEncryption/EncryptedStringConverter.cs`
- [ ] `Security/DataEncryption/KeyManagementService.cs` (Azure Key Vault)
- [ ] `Security/InputSanitizer.cs`

### 7.7 Background jobs
- [ ] `BackgroundJobs/BaseBackgroundJob.cs`
- [ ] `BackgroundJobs/AuditRetentionJob.cs`

### 7.8 External services
- [ ] `ExternalServices/ExternalServiceBase.cs`

### 7.9 File storage
- [ ] `FileStorage/AzureBlobStorageService.cs`
- [ ] `FileStorage/LocalFileStorageService.cs` _(dev)_

### 7.10 Email
- [ ] `Email/SmtpEmailService.cs` _(active)_
- [ ] `Email/SendGridEmailService.cs` _(commented)_

### 7.11 Feature flags
- [ ] `FeatureFlags/FeatureFlagService.cs` _(commented stub)_
- [ ] `FeatureFlags/FeatureFlags.cs` (constants)

### 7.12 Multi-tenancy
- [ ] `MultiTenancy/TenantResolutionStrategy.cs`
- [ ] `MultiTenancy/SharedDatabaseTenantStrategy.cs` _(active)_
- [ ] `MultiTenancy/TenantSchemaStrategy.cs` _(commented)_
- [ ] `MultiTenancy/TenantDatabaseStrategy.cs` _(commented)_

### 7.13 DI
- [ ] `DependencyInjection.cs` — `AddInfrastructure(IServiceCollection, IConfiguration)` composes all of the above

- [ ] **Checkpoint 7:** `dotnet build` green; Infrastructure DI extension composable from Api/Worker startup

---

## Phase 8 — Api host

### 8.1 Middleware
- [ ] `Middleware/CorrelationIdMiddleware.cs`
- [ ] `Middleware/GlobalExceptionMiddleware.cs` (RFC 7807)
- [ ] `Middleware/SecurityHeadersMiddleware.cs` (CSP, HSTS, X-Frame, Referrer)
- [ ] `Middleware/TenantResolutionMiddleware.cs`
- [ ] `Middleware/RequestLoggingMiddleware.cs`

### 8.2 Filters
- [ ] `Filters/ValidationEndpointFilter.cs`
- [ ] `Filters/IdempotencyEndpointFilter.cs`
- [ ] `Filters/LogEndpointFilter.cs`

### 8.3 Configuration
- [ ] `Configuration/ApiVersioningSetup.cs`
- [ ] `Configuration/RateLimitingSetup.cs`
- [ ] `Configuration/OpenApiSetup.cs`
- [ ] `Configuration/HealthCheckSetup.cs` (liveness / readiness / dependency)
- [ ] `Configuration/AuthenticationSetup.cs`
- [ ] `Configuration/CompressionSetup.cs`

### 8.4 Endpoints · platform v1
- [ ] `Endpoints/v1/AuthEndpoints.cs`
- [ ] `Endpoints/v1/UserEndpoints.cs`
- [ ] `Endpoints/v1/TenantEndpoints.cs`
- [ ] `Endpoints/v1/AuditEndpoints.cs`
- [ ] `Endpoints/v1/HealthEndpoints.cs`

### 8.5 Endpoints · EventShopper v1 (generated or hand-written per aggregate)
- [ ] `Endpoints/v1/EventShopper/*Endpoints.cs` — list / get / create / update / delete per aggregate
- [ ] Per-endpoint validators in Application feature folder

### 8.6 Extensions
- [ ] `Extensions/ServiceCollectionExtensions.cs` — composes Application + Infrastructure + Api-specific
- [ ] `Extensions/WebApplicationExtensions.cs` — orders middleware correctly

### 8.7 Program.cs
- [ ] Final wiring (Serilog → Config → Services → Middleware → MapEndpoints → Health → Run)

- [ ] **Checkpoint 8:** `dotnet run --project src/API/Enterprise.Platform.Api` → `curl /health/live` 200; Swagger renders; protected endpoint returns 401

---

## Phase 9 — Application Features (CQRS handlers)

### 9.1 Identity
- [ ] `Features/Identity/Commands/RegisterUser{Command,Handler,Validator}.cs`
- [ ] `Features/Identity/Commands/AssignRole{Command,Handler}.cs`
- [ ] `Features/Identity/Queries/GetUserById{Query,Handler}.cs`
- [ ] `Features/Identity/Queries/ListUsers{Query,Handler}.cs`
- [ ] `Features/Identity/Events/UserRegisteredEvent.cs`, `RoleAssignedEvent.cs`

### 9.2 Tenants
- [ ] `Features/Tenants/Commands/CreateTenant{Command,Handler,Validator}.cs`
- [ ] `Features/Tenants/Queries/GetTenantById{Query,Handler}.cs`
- [ ] `Features/Tenants/Events/TenantCreatedEvent.cs`

### 9.3 AuditLog
- [ ] `Features/AuditLog/Queries/GetAuditLogs{Query,Handler}.cs`

### 9.4 EventShopper (per scaffolded aggregate)
- [ ] For each aggregate: `{List, Get, Create, Update, Delete}` command/query + handler + validator
- [ ] `Features/EventShopper/Repositories/I<Agg>Repository.cs` in Application
- [ ] Matching `I<Agg>Repository` implementation in Infrastructure

- [ ] **Checkpoint 9:** Api.Tests for at least one happy-path command + one query pass

---

## Phase 10 — Worker

- [ ] `Jobs/OutboxProcessorJob.cs`
- [ ] `Jobs/AuditRetentionJob.cs`
- [ ] `Jobs/CacheWarmupJob.cs`
- [ ] `Program.cs` wiring (Hangfire or hosted-service loop)

- [ ] **Checkpoint 10:** seed an outbox row; worker drains it and logs dispatch

---

## Phase 11 — Web.UI (.NET BFF side, pre-Angular)

- [ ] `Configuration/BffAuthenticationSetup.cs`
- [ ] `Configuration/BffCorsSetup.cs`
- [ ] `Configuration/BffSecurityHeaders.cs`
- [ ] `Controllers/AuthController.cs` (login / logout / refresh / OIDC callback)
- [ ] `Controllers/AntiForgeryController.cs`
- [ ] `Controllers/BffProxyController.cs`
- [ ] `Program.cs` wiring (cookie session + token rotation)

- [ ] **Checkpoint 11:** BFF login → refresh → proxy round trip against Api succeeds

---

## Phase 12 — Test scaffolds

- [ ] `Architecture.Tests/LayerDependencyTests.cs` — Domain has no EF/Azure refs; Application has no Infrastructure refs
- [ ] `Architecture.Tests/NamingConventionTests.cs` — handlers end with `Handler`, validators with `Validator`
- [ ] `Domain.Tests/ValueObjects/EmailTests.cs`, `MoneyTests.cs`
- [ ] `Domain.Tests/Specifications/<one sample>`
- [ ] `Application.Tests/Behaviors/ValidationBehaviorTests.cs`, `TransactionBehaviorTests.cs`, `CachingBehaviorTests.cs`
- [ ] `Application.Tests/Features/Identity/RegisterUserHandlerTests.cs`
- [ ] `Infrastructure.Tests/Persistence/UnitOfWorkTests.cs`, `GenericRepositoryTests.cs`, `TenantFilterTests.cs`
- [ ] `Api.Tests/Utilities/CustomApiFactory.cs`, `TestAuthHandler.cs`
- [ ] `Api.Tests/Endpoints/HealthEndpointsTests.cs`, `AuthEndpointsTests.cs`

- [ ] **Checkpoint 12:** `dotnet test` green across all test projects

---

## Notes / Open questions log

> Append dated entries here as decisions get made or questions surface.

- **2026-04-17** — Doc created.
- **2026-04-17** — D1–D5 locked: A / B / A / A / A.
- **2026-04-17** — **PlatformDb deferred**: per user direction, we're not building the platform control-plane DB in this pass. EventShopperDb (MSSQL, DB-first) is the active target. Platform entities, code-first migrations, identity store, audit log persistence, outbox persistence, and Auth/BFF login flows are all marked `[–]` deferred until PlatformDb is revisited. Phase 5 retains the multi-DB routing scaffolding (needed for EventShopperDb anyway); Platform-specific items inside Phase 5/7/8/9/10/11 are skipped for now.
- **2026-04-17** — **Phase 0 complete.** DbSettings POCO, connection strings (Api+Worker), DtoGen skeleton, dotnet-ef local tool, Mapster CPM entries all landed. Build clean.
- **2026-04-17** — **Phase 1 complete.** All 13 Shared-tier files landed (Results, Guards, Constants, Extensions, Enumerations). Added `<NoWarn>CA1716</NoWarn>` to `Directory.Build.props` — C#-only solution, VB-interop naming rules don't apply, which let us keep the mandated `Error` type name and `Shared` namespace. `Guard` uses the Ardalis-style `IGuardClause` marker + extension methods so later tiers can plug in domain-specific guards. Full-solution build: 0 warnings, 0 errors.
- **2026-04-18** — **Phase 2 complete (Settings + Responses).** 8 new Settings POCOs (+ pre-existing `DatabaseSettings`) and 2 Response types landed. **2.3 Requests and 2.4 DTOs deferred `[–]`** to stay consistent with D4 — platform-identity contracts will arrive with PlatformDb. One analyzer hiccup (CA1000 on a static factory inside `ApiResponse<T>`) — resolved idiomatically by moving `Ok<T>(...)` to the non-generic `ApiResponse` helper (callers get type inference, analyzer happy). Full-solution build: 0 warnings, 0 errors. Repo pushed to `https://github.com/chc67840/Enterprise.Platform.git` (`main`).
- **2026-04-18** — **Phase 3 complete (Domain — zero-NuGet core).** All 31 files across 3.1–3.8 landed. Notable design calls: (a) `IWriteDbContext` is deliberately EF-free (only `SaveChangesAsync`) so Domain never sees `DbSet<T>`; handlers write through `IGenericRepository<T>`. (b) Value-object factories return `Result<T>` from Shared — first real use of the Result pattern outside tests. (c) `AggregateRoot.AddDomainEvent` is `protected`, `ClearDomainEvents` is `public` — aggregates raise, dispatcher drains. (d) Added `AsSplitQuery` to `ISpecification<T>` beyond the TODO — needed to avoid cartesian blow-ups on multi-collection includes. `dotnet list package` on Domain returns zero — D1 invariant holds manually until Phase 12 adds the architecture test.
- **2026-04-18** — **Phase 4 complete (Application — CQRS skeleton).** 35 files total: 5 messaging + 6 behavior markers + 1 persistence abstraction + 1 dispatcher + 6 common interfaces (+2 beyond TODO: `IAuditWriter`, `IIdempotencyStore`) + 6 common models + 2 common extensions + 7 pipeline behaviors (+1 beyond TODO: `LogMessages.cs` source-generated `LoggerMessage` extensions) + DI helper. **Skipped `IMappable` (4.8)** per D2 = Mapster. **CPM additions:** `Microsoft.Extensions.DependencyInjection.Abstractions`, `.Logging.Abstractions`, `.Caching.Abstractions`, `.Configuration.Abstractions`, `.Options`, `.Options.ConfigurationExtensions` — all abstractions-only, no runtime impl leaks. Analyzer battles worth keeping as replay landmines: (a) **CA1848 + CA1873** swept every `logger.LogX(...)` call — resolved properly by a consolidated source-gen `LogMessages` partial class rather than suppression; (b) **CA1711** on `RequestHandlerDelegate` suppressed inline (naming parity with MediatR is worth more than analyzer purity); (c) **CA1805** `Unit.Value = default` — removed redundant init; (d) **CA1859** on two expression-builder helpers — tightened return types to `MethodCallExpression` / `BinaryExpression`.
- **2026-04-19** — **Phase 5 complete (persistence core, D4-scoped).** 13 files total: `IDbContextFactory` (Application) + 9 Infra/Persistence files (factory, registry, UoW, spec evaluator, generic repo, connection factory, 4 interceptors) + `SystemDateTimeProvider` + `AddInfrastructure` DI root. **Platform-specific 5.3/5.4/5.5/5.6 all `[–]` deferred with D4.** Key design calls worth remembering on replay: (a) `IDbContextFactory` requires Application to reference `Microsoft.EntityFrameworkCore` (abstraction only) — accepted trade-off so the interface can return `DbContext`; (b) beyond-TODO `DbContextRegistry` (singleton, logical-name → Type map) + `RegisterDbContext<T>(name, isDefault)` DI extension is how Phase 6 will wire EventShopperDbContext; (c) beyond-TODO `SpecificationEvaluator` — `GenericRepository` needs it to translate `ISpecification<T>` to `IQueryable<T>`; (d) `DomainEventDispatchInterceptor` dispatches **after** save (handlers must be idempotent; high-value fan-out should use outbox in Phase 7); (e) the sync `SavedChanges` path unwraps the async dispatch via `Task.Run` to avoid sync-context deadlocks. **Build fix after SDK reinstall:** removed a broken `services.AddScoped(typeof(IUnitOfWork), typeof(UnitOfWork<>))` — non-generic interface cannot be backed by an open-generic impl (fails at runtime; flagged CA2263). `IUnitOfWork` registration now lands in Phase 6 as closed `UnitOfWork<EventShopperDbContext>`. Open-generic `IGenericRepository<> → GenericRepository<>` kept with `#pragma warning disable CA2263` (analyzer has no notion of open-generic bindings). **Checkpoint 5 green after SDK reinstall.**
- **2026-04-19** — **Phase 6 complete (EventShopperDb scaffold + DtoGen).** 39 scaffolded entity POCOs + `EventShopperDbContext` + 39 `{Entity}Dto` records + `EventShopperMappingRegistry` + `AddEventShopperDb` DI extension + 2 smoke tests. **Replay-critical details:** (a) `Microsoft.EntityFrameworkCore.Design` must be on **Api** csproj (dotnet-ef startup project) with `PrivateAssets=all`; (b) **DtoGen generator body built** with Roslyn syntax parsing — two-pass inventory/emit, `virtual`-keyword heuristic for nav-property skip; (c) emitted files need `#nullable enable` right after the `<auto-generated>` banner or NRT annotations hit CS8669; (d) interceptor attachment on EventShopperDbContext deliberately deferred to Phase 7 (missing dependency impls); (e) per-entity Fluent config extraction (6.3) skipped intentionally — scaffold `--force` would clobber it; (f) CA1707 suppressed project-wide in `Infrastructure.Tests.csproj` for `Given_When_Then` xUnit naming. **CPM additions:** `Microsoft.CodeAnalysis.CSharp` + `Microsoft.Extensions.Configuration{,.Json}` + `Microsoft.Extensions.DependencyInjection`. **Verification:** full-solution `dotnet build` 0/0, live-DB smoke test **3/3 passed** — end-to-end `IDbContextFactory → EventShopperDbContext → SQL Server` wiring confirmed.

---

## Out of scope for foundation (tracked separately)

These are **not** part of the foundation TODO. Plan them after Phase 12:

- Angular SPA scaffold (`ng new ClientApp --style=scss --routing`) inside `src/UI/Enterprise.Platform.Web.UI/ClientApp/`
- Domain-specific business logic beyond EventShopper CRUD
- PostgreSQL database integration (second `DbContext` once the multi-DB pattern is proven on MSSQL)
- Docker Compose for local dev (`docker/docker-compose.yml`)
- IaC (Bicep / Terraform)
- CI/CD workflows (`.github/workflows/*.yml`)
