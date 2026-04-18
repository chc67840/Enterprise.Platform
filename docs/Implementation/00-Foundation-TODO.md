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
- [ ] `Interfaces/IAuditableEntity.cs` (`CreatedBy`, `CreatedAt`, `ModifiedBy`, `ModifiedAt`)
- [ ] `Interfaces/ISoftDeletable.cs` (`IsDeleted`, `DeletedAt`, `DeletedBy`)
- [ ] `Interfaces/ITenantEntity.cs` (`TenantId`)

### 3.2 Base classes
- [ ] `Entities/BaseEntity.cs` (`Id : Guid`, `RowVersion : byte[]`)
- [ ] `Entities/AuditableEntity.cs` (implements `IAuditableEntity`)
- [ ] `Entities/TenantAuditableEntity.cs` (implements `ITenantEntity` + `IAuditableEntity`)
- [ ] `Aggregates/AggregateRoot.cs` (`_domainEvents`, `AddDomainEvent`, `ClearDomainEvents`)

### 3.3 Events
- [ ] `Events/IDomainEvent.cs` (`OccurredOn`)
- [ ] `Events/IIntegrationEvent.cs` (`EventId`, `OccurredOn`, `EventType`)

### 3.4 Value Objects
- [ ] `ValueObjects/ValueObject.cs` (equality by value via `GetEqualityComponents`)
- [ ] `ValueObjects/Email.cs`
- [ ] `ValueObjects/PhoneNumber.cs`
- [ ] `ValueObjects/Money.cs` (Amount + Currency)
- [ ] `ValueObjects/Address.cs`
- [ ] `ValueObjects/DateRange.cs` (Start/End with invariants)

### 3.5 Enumerations
- [ ] `Enumerations/Enumeration.cs` (smart enum base, reflection-based `GetAll`)

### 3.6 Exceptions
- [ ] `Exceptions/DomainException.cs` (abstract base, `ErrorCode`)
- [ ] `Exceptions/EntityNotFoundException.cs`
- [ ] `Exceptions/BusinessRuleViolationException.cs`
- [ ] `Exceptions/ConcurrencyConflictException.cs`
- [ ] `Exceptions/AccessDeniedException.cs`
- [ ] `Exceptions/TenantMismatchException.cs`

### 3.7 Specifications
- [ ] `Specifications/ISpecification.cs` (`Criteria`, `Includes`, `OrderBy`, paging)
- [ ] `Specifications/Specification.cs` (base implementation)

### 3.8 Abstractions (implemented by Infrastructure)
- [ ] `Interfaces/IGenericRepository.cs` (CRUD + specification-aware)
- [ ] `Interfaces/IUnitOfWork.cs`
- [ ] `Interfaces/IReadDbContext.cs` (exposes `IQueryable<T>` read-only, NoTracking)
- [ ] `Interfaces/IWriteDbContext.cs`
- [ ] `Interfaces/ICurrentUserService.cs` (`UserId`, `Email`, `IsAuthenticated`, `HasPermission`)
- [ ] `Interfaces/ICurrentTenantService.cs` (`TenantId`, `IsolationMode`)
- [ ] `Interfaces/IDomainEventDispatcher.cs`

- [ ] **Checkpoint 3:** `dotnet build src/Core/Enterprise.Platform.Domain` green; Architecture tests (if added) confirm Domain has zero NuGet deps

---

## Phase 4 — Application (CQRS skeleton, pipeline behaviors)

**Project:** `src/Core/Enterprise.Platform.Application/`

### 4.1 Messaging abstractions
- [ ] `Abstractions/Messaging/ICommand.cs` / `ICommand<TResult>`
- [ ] `Abstractions/Messaging/ICommandHandler.cs`
- [ ] `Abstractions/Messaging/IQuery.cs`
- [ ] `Abstractions/Messaging/IQueryHandler.cs`
- [ ] `Abstractions/Messaging/IDispatcher.cs`

### 4.2 Behavior abstractions (marker interfaces)
- [ ] `Abstractions/Behaviors/IPipelineBehavior.cs`
- [ ] `Abstractions/Behaviors/ITransactional.cs`
- [ ] `Abstractions/Behaviors/ICacheable.cs`
- [ ] `Abstractions/Behaviors/IRequiresAudit.cs`
- [ ] `Abstractions/Behaviors/IIdempotent.cs`
- [ ] `Abstractions/Behaviors/IRequiresDualApproval.cs`

### 4.3 Persistence abstraction (for Dapper-style raw read path)
- [ ] `Abstractions/Persistence/IDbConnectionFactory.cs`

### 4.4 Dispatcher
- [ ] `Dispatcher/Dispatcher.cs` — lightweight mediator, pipeline-aware

### 4.5 Common services
- [ ] `Common/Interfaces/IDateTimeProvider.cs`
- [ ] `Common/Interfaces/IFileStorageService.cs`
- [ ] `Common/Interfaces/IEmailService.cs`
- [ ] `Common/Interfaces/INotificationService.cs`

### 4.6 Common models
- [ ] `Common/Models/PagedRequest.cs` (offset pagination)
- [ ] `Common/Models/CursorPagedRequest.cs`
- [ ] `Common/Models/PagedResult.cs`
- [ ] `Common/Models/CursorPagedResult.cs`
- [ ] `Common/Models/SortDescriptor.cs`
- [ ] `Common/Models/FilterDescriptor.cs`

### 4.7 Common extensions
- [ ] `Common/Extensions/QueryableExtensions.cs` — `ApplyPaging`, `ApplySorting`, `ApplyFilters`
- [ ] `Common/Extensions/StringExtensions.cs`

### 4.8 Mapping contracts
- [ ] `Common/Mappings/IMappable.cs` _(if D2 = Mapster this may be redundant)_

### 4.9 Pipeline behaviors (ordered 1→7)
- [ ] `Behaviors/LoggingBehavior.cs` (order 1 — structured entry/exit + elapsed)
- [ ] `Behaviors/ValidationBehavior.cs` (order 2 — FluentValidation)
- [ ] `Behaviors/TenantFilterBehavior.cs` (order 3 — sets tenant context)
- [ ] `Behaviors/AuditBehavior.cs` (order 4 — audit trail creation)
- [ ] `Behaviors/TransactionBehavior.cs` (order 5 — begin/commit/rollback)
- [ ] `Behaviors/CachingBehavior.cs` (order 6 — cache-aside for queries)
- [ ] `Behaviors/IdempotencyBehavior.cs` (order 7 — idempotency-key check)

### 4.10 DI
- [ ] `DependencyInjection.cs` — `AddApplication(IServiceCollection, IConfiguration)`: scans handlers, registers behaviors, dispatcher, FluentValidation

- [ ] **Checkpoint 4:** `dotnet build src/Core/Enterprise.Platform.Application` green

---

## Phase 5 — Infrastructure · Persistence Core (PlatformDb + multi-DB routing)

**Project:** `src/Infrastructure/Enterprise.Platform.Infrastructure/`

### 5.1 DB factory + contexts
- [ ] `Persistence/IDbContextFactory.cs` (Application-level abstraction; goes in Application)
- [ ] `Persistence/DbContextFactory.cs` (Infrastructure impl, resolves by logical name)
- [ ] `Persistence/Platform/PlatformWriteDbContext.cs`
- [ ] `Persistence/Platform/PlatformReadDbContext.cs` (`NoTracking` globally)
- [ ] `Persistence/UnitOfWork.cs` (1-arg constructor, wraps factory)
- [ ] `Persistence/GenericRepository.cs`
- [ ] `Persistence/DbConnectionFactory.cs` (raw ADO.NET)

### 5.2 Interceptors
- [ ] `Persistence/Interceptors/AuditableEntityInterceptor.cs`
- [ ] `Persistence/Interceptors/SoftDeleteInterceptor.cs`
- [ ] `Persistence/Interceptors/TenantQueryFilterInterceptor.cs`
- [ ] `Persistence/Interceptors/DomainEventDispatchInterceptor.cs`

### 5.3 EF Fluent configurations (platform entities)
- [ ] `Persistence/Platform/Configurations/UserConfiguration.cs`
- [ ] `Persistence/Platform/Configurations/RoleConfiguration.cs`
- [ ] `Persistence/Platform/Configurations/TenantConfiguration.cs`
- [ ] `Persistence/Platform/Configurations/AuditLogConfiguration.cs`
- [ ] `Persistence/Platform/Configurations/OutboxMessageConfiguration.cs`

### 5.4 Platform entities (code-first)
- [ ] `Persistence/Platform/Entities/User.cs`
- [ ] `Persistence/Platform/Entities/Role.cs`
- [ ] `Persistence/Platform/Entities/Tenant.cs`
- [ ] `Persistence/Platform/Entities/AuditLog.cs`
- [ ] `Persistence/Platform/Entities/OutboxMessage.cs`

### 5.5 Seeding
- [ ] `Persistence/Seeding/ISeedData.cs`
- [ ] `Persistence/Seeding/RoleSeedData.cs` (default roles)
- [ ] `Persistence/Seeding/DefaultTenantSeedData.cs`

### 5.6 Initial migration
- [ ] `dotnet ef migrations add InitialCreate --context PlatformWriteDbContext`
- [ ] `dotnet ef database update --context PlatformWriteDbContext` against PlatformDb

- [ ] **Checkpoint 5:** build green; PlatformDb tables exist; seeding runs once without errors

---

## Phase 6 — DB-first scaffold · EventShopperDb (MSSQL)

### 6.1 Verify connectivity
- [ ] Run `sqlcmd -S localhost -E -Q "SELECT DB_NAME(),@@VERSION"` (or equivalent) to confirm the dev box reaches the server

### 6.2 Scaffold EF context + entities
- [ ] `dotnet ef dbcontext scaffold "<EventShopperDb conn>" Microsoft.EntityFrameworkCore.SqlServer --project src/Infrastructure/Enterprise.Platform.Infrastructure --startup-project src/API/Enterprise.Platform.Api --context EventShopperDbContext --context-dir Persistence/EventShopper/Contexts --output-dir Persistence/EventShopper/Entities --namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities --context-namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Contexts --no-onconfiguring --no-pluralize --use-database-names --force`
- [ ] Verify entities + `EventShopperDbContext` compiled

### 6.3 Refactor scaffolded artifacts
- [ ] Move Fluent config calls from `OnModelCreating` into `Persistence/EventShopper/Configurations/*.cs` (one file per entity) for maintainability _(optional but recommended)_
- [ ] Strip `System.ComponentModel.DataAnnotations` attributes if any slipped in
- [ ] Ensure generated types are `partial class` so we can extend without touching generated code

### 6.4 Run DtoGen tool
- [ ] `dotnet run --project tools/Enterprise.Platform.DtoGen -- --entities src/Infrastructure/Enterprise.Platform.Infrastructure/Persistence/EventShopper/Entities --dto-out src/Contracts/Enterprise.Platform.Contracts/DTOs/EventShopper --mapping-out src/Infrastructure/Enterprise.Platform.Infrastructure/Persistence/EventShopper/Mappings --namespace-dto Enterprise.Platform.Contracts.DTOs.EventShopper --namespace-map Enterprise.Platform.Infrastructure.Persistence.EventShopper.Mappings`
- [ ] If **D2 = Mapster**: emitted `EventShopperMappingRegistry.cs` registers all `TypeAdapterConfig`s

### 6.5 Register EventShopperDbContext with the factory
- [ ] Add named registration in `DbContextFactory` (`"EventShopper"` → `EventShopperDbContext`)
- [ ] Bind to `DatabaseSettings["EventShopperDb"]`
- [ ] Add to `ServiceCollectionExtensions` DI wiring

### 6.6 Smoke test
- [ ] Transient test: in a `dotnet run` or unit test, resolve `IDbContextFactory`, get `EventShopperDbContext`, do `await ctx.<firsttable>.Take(1).ToListAsync()` and log shape
- [ ] Confirm **no** EF migrations attempted against EventShopperDb (DB-first)

- [ ] **Checkpoint 6:** entities compile; DTOs + mappings generated; EventShopperDbContext queries live DB successfully

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

---

## Out of scope for foundation (tracked separately)

These are **not** part of the foundation TODO. Plan them after Phase 12:

- Angular SPA scaffold (`ng new ClientApp --style=scss --routing`) inside `src/UI/Enterprise.Platform.Web.UI/ClientApp/`
- Domain-specific business logic beyond EventShopper CRUD
- PostgreSQL database integration (second `DbContext` once the multi-DB pattern is proven on MSSQL)
- Docker Compose for local dev (`docker/docker-compose.yml`)
- IaC (Bicep / Terraform)
- CI/CD workflows (`.github/workflows/*.yml`)
