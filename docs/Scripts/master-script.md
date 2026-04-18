# Enterprise.Platform - Master Scaffold Script

> **Target**: .NET 10 + Angular 21 | Azure-first | Domain-agnostic enterprise foundation
> **Approach**: Foundation-first (cross-cutting infra), then domain modules
> **Multi-tenancy**: All 3 models supported (configurable, scaffolded as commented code)
> **Generated from**: RIMS architecture analysis (Docs/Architecture/01-10)

---

## Table of Contents

1. [Project Architecture Overview](#1-project-architecture-overview)
2. [Folder Structure (Full Tree)](#2-folder-structure-full-tree)
3. [Project Dependency Map](#3-project-dependency-map)
4. [Scaffold Script](#4-scaffold-script)
5. [What Each Project Contains](#5-what-each-project-contains)

---

## 1. Project Architecture Overview

```
+------------------------------------------------------------------+
|                    PRESENTATION TIER                               |
|  Enterprise.Platform.Web.UI         (Angular 21 SPA + BFF Host) |
|  - Serves Angular SPA, manages JWT/OIDC, anti-forgery, CORS      |
|  - BFF pattern: browser never talks directly to internal API      |
+------------------------------------------------------------------+
          | HTTPS + JWT + XSRF + CSP
+------------------------------------------------------------------+
|                      API TIER                                      |
|  Enterprise.Platform.Api             (Minimal API host)           |
|  - Versioned API endpoints grouped by feature                     |
|  - Middleware: exception, correlation ID, security headers         |
|  - Filters: validation, logging, rate limiting                     |
|  - Health checks: liveness, readiness, dependency                  |
+------------------------------------------------------------------+
          | DI-resolved services (scoped)
+------------------------------------------------------------------+
|                APPLICATION TIER (CQRS)                             |
|  Enterprise.Platform.Application                                  |
|  - Commands/Queries with handlers                                  |
|  - Pipeline behaviors: Logging, Validation, Transaction,           |
|    Caching, Audit, Multi-Tenancy, Idempotency                     |
|  - Features/ organized as vertical slices                          |
|  - Domain services, factories, strategies                          |
+------------------------------------------------------------------+
       |                          |
+------------------+   +--------------------------------------------+
| DOMAIN TIER      |   | INFRASTRUCTURE TIER                        |
| Enterprise.      |   | Enterprise.Platform.Infrastructure         |
| Platform.Domain  |   | - Persistence: Read/Write DbContext,       |
|                  |   |   UnitOfWork, GenericRepository             |
| - Entities       |   | - Identity: OAuth 2.1, OIDC, RBAC, ABAC   |
| - Value Objects  |   | - Caching: In-Memory + Redis               |
| - Aggregates     |   | - Messaging: Outbox, domain/integration    |
| - Domain Events  |   | - Resilience: Polly pipelines              |
| - Specifications |   | - Observability: OTel, structured logging  |
| - Interfaces     |   | - Security: encryption, data protection    |
| - Exceptions     |   | - BackgroundJobs: Hangfire/Worker Services  |
| (ZERO deps)      |   | - ExternalServices: HTTP/SOAP/gRPC clients |
+------------------+   | - FileStorage, Email, FeatureFlags         |
                        +--------------------------------------------+
       |                          |
+------------------------------------------------------------------+
|                    SHARED / CONTRACTS                               |
|  Enterprise.Platform.Contracts   (DTOs, Settings, API contracts)  |
|  Enterprise.Platform.Shared      (Result<T>, enums, base classes) |
+------------------------------------------------------------------+
       |
+------------------------------------------------------------------+
|                    DATA PERSISTENCE                                 |
|  SQL Server (Azure SQL) + Redis Cache + Azure Blob Storage        |
|  - Read replicas (optional)                                        |
|  - TDE + column-level encryption                                   |
|  - Global query filters (soft delete, multi-tenancy)               |
+------------------------------------------------------------------+
```

---

## 2. Folder Structure (Full Tree)

```
Enterprise.Platform/
|
+-- src/
|   |
|   +-- UI/
|   |   |
|   |   +-- Enterprise.Platform.Web.UI/              # BFF Host + Angular SPA
|   |       +-- ClientApp/                             # Angular 21 application
|   |       |   +-- src/
|   |       |       +-- app/
|   |       |       |   +-- core/                      # Singleton services, guards, interceptors
|   |       |       |   |   +-- auth/                  # AuthGuard, AuthService, token management
|   |       |       |   |   +-- interceptors/           # HttpInterceptor (JWT, XSRF, correlation ID)
|   |       |       |   |   +-- guards/                 # AuthGuard, RoleGuard, TenantGuard
|   |       |       |   |   +-- services/               # SessionService, TenantService
|   |       |       |   |   +-- models/                 # Core interfaces & types
|   |       |       |   +-- shared/                     # Shared module (components, pipes, directives)
|   |       |       |   |   +-- components/             # Generic reusable UI components
|   |       |       |   |   |   +-- data-table/         # Configurable generic table
|   |       |       |   |   |   +-- form-field/         # Generic form field wrapper
|   |       |       |   |   |   +-- modal/              # Generic modal dialog
|   |       |       |   |   |   +-- toast/              # Toast notification
|   |       |       |   |   |   +-- loading/            # Loading spinner/skeleton
|   |       |       |   |   |   +-- error-boundary/     # Error boundary component
|   |       |       |   |   |   +-- pagination/         # Cursor/offset pagination
|   |       |       |   |   |   +-- file-upload/        # File upload with drag-drop
|   |       |       |   |   +-- pipes/                  # DateFormat, Currency, Mask, Truncate
|   |       |       |   |   +-- directives/             # ClickOutside, Debounce, Permission
|   |       |       |   |   +-- validators/             # Custom form validators
|   |       |       |   +-- features/                   # Lazy-loaded feature modules
|   |       |       |   |   +-- dashboard/              # Landing dashboard
|   |       |       |   |   +-- admin/                  # User/role/tenant management
|   |       |       |   |   +-- settings/               # App settings, profile
|   |       |       |   |   +-- _domain-placeholder/    # Placeholder for domain features
|   |       |       |   +-- layouts/                    # Shell layout, sidebar, topbar
|   |       |       |   +-- app.component.ts
|   |       |       |   +-- app.config.ts
|   |       |       |   +-- app.routes.ts
|   |       |       +-- environments/                   # Environment configs
|   |       |       +-- styles/                         # Global styles, Tailwind config
|   |       |       +-- assets/
|   |       +-- Controllers/                            # MVC controllers (BFF proxy)
|   |       |   +-- AuthController.cs                   # Login, logout, refresh, OIDC callback
|   |       |   +-- AntiForgeryController.cs            # XSRF token endpoint
|   |       |   +-- BffProxyController.cs               # Generic proxy to internal API
|   |       +-- Configuration/                          # BFF-specific config
|   |       |   +-- BffAuthenticationSetup.cs           # JWT + OIDC setup
|   |       |   +-- BffCorsSetup.cs                     # CORS policy
|   |       |   +-- BffSecurityHeaders.cs               # CSP, HSTS, X-Frame, etc.
|   |       +-- Program.cs
|   |       +-- appsettings.json
|   |       +-- appsettings.Development.json
|   |
|   +-- API/
|   |   |
|   |   +-- Enterprise.Platform.Api/                    # Internal API Host (Minimal API)
|   |       +-- Endpoints/                              # Minimal API endpoint groups
|   |       |   +-- v1/                                 # API version 1
|   |       |   |   +-- AuthEndpoints.cs                # Authentication endpoints
|   |       |   |   +-- UserEndpoints.cs                # User management
|   |       |   |   +-- TenantEndpoints.cs              # Tenant management
|   |       |   |   +-- AuditEndpoints.cs               # Audit log queries
|   |       |   |   +-- HealthEndpoints.cs              # Health check endpoints
|   |       |   |   +-- _DomainEndpointsPlaceholder.cs  # Placeholder for domain endpoints
|   |       |   +-- EndpointRouteBuilderExtensions.cs   # Route group registration
|   |       +-- Middleware/                             # HTTP middleware pipeline
|   |       |   +-- CorrelationIdMiddleware.cs           # X-Correlation-ID propagation
|   |       |   +-- GlobalExceptionMiddleware.cs         # Exception -> ProblemDetails (RFC 7807)
|   |       |   +-- SecurityHeadersMiddleware.cs         # Security response headers
|   |       |   +-- TenantResolutionMiddleware.cs        # Resolve tenant from header/subdomain/path
|   |       |   +-- RequestLoggingMiddleware.cs          # Structured request/response logging
|   |       +-- Filters/                                # Endpoint filters
|   |       |   +-- ValidationEndpointFilter.cs          # FluentValidation integration
|   |       |   +-- IdempotencyEndpointFilter.cs         # Idempotency-Key header
|   |       |   +-- LogEndpointFilter.cs                 # Per-endpoint timing
|   |       +-- Configuration/                          # API-specific setup
|   |       |   +-- ApiVersioningSetup.cs                # URL-based API versioning
|   |       |   +-- RateLimitingSetup.cs                 # Token bucket, per-tenant, sliding window
|   |       |   +-- OpenApiSetup.cs                      # Swagger/OpenAPI spec generation
|   |       |   +-- HealthCheckSetup.cs                  # Liveness, readiness, dependency checks
|   |       |   +-- AuthenticationSetup.cs               # Bearer token validation
|   |       |   +-- CompressionSetup.cs                  # Brotli/Gzip response compression
|   |       +-- Extensions/
|   |       |   +-- ServiceCollectionExtensions.cs       # All DI registration
|   |       |   +-- WebApplicationExtensions.cs          # Middleware pipeline ordering
|   |       +-- Program.cs
|   |       +-- appsettings.json
|   |       +-- appsettings.Development.json
|   |       +-- appsettings.Staging.json
|   |       +-- appsettings.Production.json
|   |
|   +-- Core/
|   |   |
|   |   +-- Enterprise.Platform.Domain/                 # Pure Domain Layer (ZERO dependencies)
|   |   |   +-- Entities/                               # Entity base classes
|   |   |   |   +-- BaseEntity.cs                       # Id, RowVersion
|   |   |   |   +-- AuditableEntity.cs                  # CreatedBy/At, ModifiedBy/At
|   |   |   |   +-- TenantAuditableEntity.cs            # + TenantId
|   |   |   |   +-- _DomainEntitiesPlaceholder.cs       # Placeholder for domain entities
|   |   |   +-- ValueObjects/                           # Immutable value types
|   |   |   |   +-- ValueObject.cs                      # Base value object (equality by value)
|   |   |   |   +-- Email.cs                            # Validated email
|   |   |   |   +-- PhoneNumber.cs                      # Validated phone
|   |   |   |   +-- Money.cs                            # Amount + Currency (finance domains)
|   |   |   |   +-- Address.cs                          # Street, City, State, Zip, Country
|   |   |   |   +-- DateRange.cs                        # Start/End with invariants
|   |   |   +-- Aggregates/                             # Aggregate root base
|   |   |   |   +-- AggregateRoot.cs                    # Domain event collection
|   |   |   +-- Events/                                 # Domain event contracts
|   |   |   |   +-- IDomainEvent.cs                     # Marker interface + OccurredOn
|   |   |   |   +-- IIntegrationEvent.cs                # Cross-boundary events (outbox)
|   |   |   +-- Specifications/                         # Specification pattern
|   |   |   |   +-- ISpecification.cs                   # Criteria, Includes, OrderBy
|   |   |   |   +-- Specification.cs                    # Base implementation
|   |   |   +-- Interfaces/                             # Domain abstractions
|   |   |   |   +-- IGenericRepository.cs               # CRUD contract
|   |   |   |   +-- IUnitOfWork.cs                      # Transaction boundary
|   |   |   |   +-- IReadDbContext.cs                   # Read-only context interface
|   |   |   |   +-- IWriteDbContext.cs                  # Write context interface
|   |   |   |   +-- IAuditableEntity.cs                 # Audit stamp interface
|   |   |   |   +-- ISoftDeletable.cs                   # IsDeleted, DeletedAt, DeletedBy
|   |   |   |   +-- ITenantEntity.cs                    # TenantId marker
|   |   |   |   +-- IDomainEventDispatcher.cs           # Dispatch domain events
|   |   |   |   +-- ICurrentUserService.cs              # Current user abstraction
|   |   |   |   +-- ICurrentTenantService.cs            # Current tenant abstraction
|   |   |   +-- Enumerations/                           # Smart enum base
|   |   |   |   +-- Enumeration.cs                      # Abstract smart enum
|   |   |   +-- Exceptions/                             # Domain exception hierarchy
|   |   |   |   +-- DomainException.cs                  # Base domain exception
|   |   |   |   +-- EntityNotFoundException.cs          # 404
|   |   |   |   +-- BusinessRuleViolationException.cs   # 422
|   |   |   |   +-- ConcurrencyConflictException.cs     # 409
|   |   |   |   +-- AccessDeniedException.cs            # 403
|   |   |   |   +-- TenantMismatchException.cs          # Cross-tenant access attempt
|   |   |
|   |   +-- Enterprise.Platform.Application/            # Application Layer (CQRS)
|   |       +-- Abstractions/                           # CQRS contracts
|   |       |   +-- Messaging/
|   |       |   |   +-- ICommand.cs                     # ICommand<TResult>
|   |       |   |   +-- ICommandHandler.cs              # Handler contract
|   |       |   |   +-- IQuery.cs                       # IQuery<TResult>
|   |       |   |   +-- IQueryHandler.cs                # Handler contract
|   |       |   |   +-- IDispatcher.cs                  # Lightweight mediator
|   |       |   +-- Behaviors/                          # Pipeline behavior contracts
|   |       |   |   +-- IPipelineBehavior.cs            # Behavior interface
|   |       |   |   +-- ITransactional.cs               # Marker: wrap in transaction
|   |       |   |   +-- ICacheable.cs                   # Marker: cache result
|   |       |   |   +-- IRequiresAudit.cs               # Marker: audit this operation
|   |       |   |   +-- IIdempotent.cs                  # Marker: idempotency support
|   |       |   |   +-- IRequiresDualApproval.cs        # Marker: dual approval (finance)
|   |       |   +-- Persistence/
|   |       |       +-- IDbConnectionFactory.cs         # Raw ADO.NET for read-heavy queries
|   |       +-- Behaviors/                              # Pipeline behavior implementations
|   |       |   +-- LoggingBehavior.cs                  # Log entry/exit/elapsed (order: 1)
|   |       |   +-- ValidationBehavior.cs               # FluentValidation (order: 2)
|   |       |   +-- TenantFilterBehavior.cs             # Set tenant context (order: 3)
|   |       |   +-- AuditBehavior.cs                    # Audit trail creation (order: 4)
|   |       |   +-- TransactionBehavior.cs              # Begin/Commit/Rollback (order: 5)
|   |       |   +-- CachingBehavior.cs                  # Cache-aside for queries (order: 6)
|   |       |   +-- IdempotencyBehavior.cs              # Idempotency-key check (order: 7)
|   |       +-- Dispatcher/
|   |       |   +-- Dispatcher.cs                       # Lightweight mediator implementation
|   |       +-- Features/                               # Vertical slice feature folders
|   |       |   +-- Identity/                           # Identity & access management
|   |       |   |   +-- Commands/
|   |       |   |   |   +-- RegisterUserCommand.cs
|   |       |   |   |   +-- RegisterUserHandler.cs
|   |       |   |   |   +-- RegisterUserValidator.cs
|   |       |   |   |   +-- AssignRoleCommand.cs
|   |       |   |   |   +-- AssignRoleHandler.cs
|   |       |   |   +-- Queries/
|   |       |   |   |   +-- GetUserByIdQuery.cs
|   |       |   |   |   +-- GetUserByIdHandler.cs
|   |       |   |   |   +-- ListUsersQuery.cs
|   |       |   |   |   +-- ListUsersHandler.cs
|   |       |   |   +-- Events/
|   |       |   |   |   +-- UserRegisteredEvent.cs
|   |       |   |   |   +-- RoleAssignedEvent.cs
|   |       |   |   +-- Services/
|   |       |   |       +-- IIdentityService.cs
|   |       |   +-- Tenants/                            # Multi-tenancy management
|   |       |   |   +-- Commands/
|   |       |   |   |   +-- CreateTenantCommand.cs
|   |       |   |   |   +-- CreateTenantHandler.cs
|   |       |   |   |   +-- CreateTenantValidator.cs
|   |       |   |   +-- Queries/
|   |       |   |   |   +-- GetTenantByIdQuery.cs
|   |       |   |   |   +-- GetTenantByIdHandler.cs
|   |       |   |   +-- Events/
|   |       |   |       +-- TenantCreatedEvent.cs
|   |       |   +-- AuditLog/                           # Audit log queries
|   |       |   |   +-- Queries/
|   |       |   |       +-- GetAuditLogsQuery.cs
|   |       |   |       +-- GetAuditLogsHandler.cs
|   |       |   +-- _DomainFeaturesPlaceholder/         # Placeholder for domain features
|   |       +-- Common/                                 # Shared application services
|   |       |   +-- Interfaces/
|   |       |   |   +-- IDateTimeProvider.cs            # Abstracted clock
|   |       |   |   +-- IFileStorageService.cs          # File upload/download
|   |       |   |   +-- IEmailService.cs                # Email sending
|   |       |   |   +-- INotificationService.cs         # Push/in-app notifications
|   |       |   +-- Models/
|   |       |   |   +-- PagedRequest.cs                 # Offset pagination input
|   |       |   |   +-- CursorPagedRequest.cs           # Cursor pagination input
|   |       |   |   +-- PagedResult.cs                  # Paged response wrapper
|   |       |   |   +-- CursorPagedResult.cs            # Cursor paged response
|   |       |   |   +-- SortDescriptor.cs               # Sort column + direction
|   |       |   |   +-- FilterDescriptor.cs             # Filter field + operator + value
|   |       |   +-- Extensions/
|   |       |   |   +-- QueryableExtensions.cs          # ApplyPaging, ApplySorting, ApplyFilters
|   |       |   |   +-- StringExtensions.cs
|   |       |   +-- Mappings/
|   |       |       +-- IMappable.cs                    # Entity -> DTO mapping contract
|   |       +-- DependencyInjection.cs                  # Application layer DI registration
|   |
|   +-- Infrastructure/
|   |   |
|   |   +-- Enterprise.Platform.Infrastructure/         # All infrastructure implementations
|   |       +-- Persistence/                            # EF Core data access
|   |       |   +-- AppWriteDbContext.cs                 # Write context: tracking + audit stamps
|   |       |   +-- AppReadDbContext.cs                  # Read context: NoTracking globally
|   |       |   +-- UnitOfWork.cs                        # Simplified UoW (1 param constructor)
|   |       |   +-- GenericRepository.cs                 # Fixed generic repository
|   |       |   +-- DbConnectionFactory.cs               # Raw ADO.NET connection factory
|   |       |   +-- Configurations/                     # EF Fluent API entity configs
|   |       |   |   +-- UserConfiguration.cs
|   |       |   |   +-- RoleConfiguration.cs
|   |       |   |   +-- TenantConfiguration.cs
|   |       |   |   +-- AuditLogConfiguration.cs
|   |       |   |   +-- OutboxMessageConfiguration.cs
|   |       |   +-- Interceptors/                       # EF interceptors
|   |       |   |   +-- AuditableEntityInterceptor.cs    # Auto-fill CreatedBy/ModifiedBy
|   |       |   |   +-- SoftDeleteInterceptor.cs         # Convert Delete -> IsDeleted=true
|   |       |   |   +-- TenantQueryFilterInterceptor.cs  # Global tenant filter
|   |       |   |   +-- DomainEventDispatchInterceptor.cs # Dispatch events after SaveChanges
|   |       |   +-- Migrations/                         # EF Core migrations folder
|   |       |   +-- Seeding/                            # Seed data
|   |       |       +-- ISeedData.cs
|   |       |       +-- RoleSeedData.cs
|   |       |       +-- DefaultTenantSeedData.cs
|   |       +-- Identity/                               # Authentication & Authorization
|   |       |   +-- OAuth/
|   |       |   |   +-- OAuthConfiguration.cs            # OAuth 2.1 + OIDC setup
|   |       |   |   +-- TokenService.cs                  # JWT generation, refresh rotation
|   |       |   |   +-- RefreshTokenCleanupJob.cs        # Background cleanup of expired tokens
|   |       |   +-- Authorization/
|   |       |   |   +-- PermissionAuthorizationHandler.cs # Policy-based auth handler
|   |       |   |   +-- RbacPolicyProvider.cs             # Role-based policy provider
|   |       |   |   +-- AbacPolicyEvaluator.cs            # Attribute-based (commented scaffold)
|   |       |   |   +-- ResourceOwnershipHandler.cs       # IDOR prevention
|   |       |   +-- Services/
|   |       |   |   +-- CurrentUserService.cs             # ICurrentUserService implementation
|   |       |   |   +-- CurrentTenantService.cs           # ICurrentTenantService implementation
|   |       |   |   +-- LoginProtectionService.cs         # Progressive delay + lockout
|   |       +-- Caching/                                # Cache implementations
|   |       |   +-- InMemoryCacheProvider.cs              # IMemoryCache wrapper
|   |       |   +-- RedisCacheProvider.cs                 # IDistributedCache wrapper (commented)
|   |       |   +-- CacheKeys.cs                          # Centralized cache key constants
|   |       |   +-- CacheInvalidationService.cs           # Cache eviction on writes
|   |       +-- Messaging/                              # Event & messaging infrastructure
|   |       |   +-- Outbox/
|   |       |   |   +-- OutboxMessage.cs                  # Outbox entity
|   |       |   |   +-- OutboxProcessor.cs                # Background job: process outbox
|   |       |   |   +-- OutboxCleanupJob.cs               # Purge processed messages
|   |       |   +-- DomainEvents/
|   |       |   |   +-- DomainEventDispatcher.cs          # In-process event dispatcher
|   |       |   +-- IntegrationEvents/
|   |       |       +-- IntegrationEventPublisher.cs      # Outbox-backed publisher (commented)
|   |       +-- Resilience/                             # Polly resilience pipelines
|   |       |   +-- ResiliencePipelineSetup.cs            # Retry, circuit breaker, timeout
|   |       |   +-- HttpClientResilienceSetup.cs          # Typed HttpClient with Polly
|   |       +-- Observability/                          # Telemetry & monitoring
|   |       |   +-- OpenTelemetrySetup.cs                 # Tracing + Metrics + OTLP export
|   |       |   +-- StructuredLoggingSetup.cs             # Serilog/JSON logging config
|   |       |   +-- BusinessMetrics.cs                    # Custom business counters/histograms
|   |       |   +-- PiiScrubber.cs                        # Redact PII from logs
|   |       +-- Security/                               # Data protection & encryption
|   |       |   +-- DataEncryption/
|   |       |   |   +-- EncryptedStringConverter.cs       # EF value converter for encrypted cols
|   |       |   |   +-- KeyManagementService.cs           # Key rotation via Azure Key Vault
|   |       |   +-- InputSanitizer.cs                    # XSS prevention
|   |       +-- BackgroundJobs/                         # Background processing
|   |       |   +-- BaseBackgroundJob.cs                  # Common job infrastructure
|   |       |   +-- AuditRetentionJob.cs                  # Archive + purge old audit logs
|   |       |   +-- _DomainJobsPlaceholder.cs             # Placeholder for domain jobs
|   |       +-- ExternalServices/                       # External HTTP/SOAP/gRPC clients
|   |       |   +-- ExternalServiceBase.cs                # Base with resilience + logging
|   |       |   +-- _ExternalServicePlaceholder.cs        # Placeholder for domain services
|   |       +-- FileStorage/                            # File storage abstraction
|   |       |   +-- AzureBlobStorageService.cs            # Azure Blob Storage implementation
|   |       |   +-- LocalFileStorageService.cs            # Local FS for development
|   |       +-- Email/                                  # Email service
|   |       |   +-- SmtpEmailService.cs                   # SMTP implementation
|   |       |   +-- SendGridEmailService.cs               # SendGrid (commented)
|   |       +-- FeatureFlags/                           # Feature management
|   |       |   +-- FeatureFlagService.cs                 # Azure App Configuration (commented)
|   |       |   +-- FeatureFlags.cs                       # Feature flag constants
|   |       +-- MultiTenancy/                           # Multi-tenancy implementations
|   |       |   +-- TenantResolutionStrategy.cs           # Header/subdomain/path resolution
|   |       |   +-- TenantDatabaseStrategy.cs             # DB-per-tenant (commented)
|   |       |   +-- TenantSchemaStrategy.cs               # Schema-per-tenant (commented)
|   |       |   +-- SharedDatabaseTenantStrategy.cs       # Shared DB + TenantId filter (active)
|   |       +-- DependencyInjection.cs                  # Infrastructure DI registration
|   |
|   +-- Contracts/
|   |   |
|   |   +-- Enterprise.Platform.Contracts/              # Shared DTOs & Settings
|   |   |   +-- DTOs/                                   # Flat DTOs (entity-level)
|   |   |   |   +-- UserDto.cs
|   |   |   |   +-- RoleDto.cs
|   |   |   |   +-- TenantDto.cs
|   |   |   |   +-- AuditLogDto.cs
|   |   |   +-- Requests/                              # API request models
|   |   |   |   +-- LoginRequest.cs
|   |   |   |   +-- RefreshTokenRequest.cs
|   |   |   |   +-- CreateTenantRequest.cs
|   |   |   |   +-- RegisterUserRequest.cs
|   |   |   +-- Responses/                             # API response wrappers
|   |   |   |   +-- ApiResponse.cs                      # Standard { data, success, errors }
|   |   |   |   +-- ProblemDetailsExtended.cs            # RFC 7807 extensions
|   |   |   +-- Settings/                              # Configuration POCOs
|   |   |       +-- AppSettings.cs                      # General app config
|   |   |       +-- JwtSettings.cs                      # JWT configuration
|   |   |       +-- CorsSettings.cs                     # CORS origins
|   |   |       +-- RateLimitSettings.cs                # Rate limiting thresholds
|   |   |       +-- CacheSettings.cs                    # Cache TTLs
|   |   |       +-- AzureSettings.cs                    # Key Vault, Blob, App Config
|   |   |       +-- MultiTenancySettings.cs             # Tenant isolation mode config
|   |   |       +-- ObservabilitySettings.cs            # OTel, logging config
|   |   |
|   |   +-- Enterprise.Platform.Shared/                # Shared Kernel (referenced by all)
|   |       +-- Results/                               # Result pattern
|   |       |   +-- Result.cs                           # Result<T> with Success/Failure
|   |       |   +-- Error.cs                            # Typed error with code + message
|   |       |   +-- ErrorCodes.cs                       # Standard error code constants
|   |       +-- Guards/                                # Defensive guard clauses
|   |       |   +-- Guard.cs                            # Guard.Against.Null, Empty, OutOfRange
|   |       +-- Extensions/                            # Universal extension methods
|   |       |   +-- StringExtensions.cs
|   |       |   +-- DateTimeExtensions.cs
|   |       |   +-- EnumerableExtensions.cs
|   |       +-- Constants/                             # Shared constants
|   |       |   +-- AppConstants.cs                     # Max lengths, default values
|   |       |   +-- HttpHeaderNames.cs                  # X-Correlation-ID, X-Tenant-ID, etc.
|   |       |   +-- ClaimTypes.cs                       # Custom claim type names
|   |       +-- Enumerations/                          # Shared enums
|   |           +-- SortDirection.cs
|   |           +-- FilterOperator.cs
|   |           +-- TenantIsolationMode.cs              # SharedDatabase, SchemaPerTenant, DbPerTenant
|   |
|   +-- Batch/
|       |
|       +-- Enterprise.Platform.Worker/                # Background Worker Service host
|           +-- Jobs/
|           |   +-- OutboxProcessorJob.cs               # Process outbox messages
|           |   +-- AuditRetentionJob.cs                # Audit log retention
|           |   +-- CacheWarmupJob.cs                   # Warm caches on startup
|           +-- Program.cs
|           +-- appsettings.json
|
+-- tests/
|   |
|   +-- Enterprise.Platform.Domain.Tests/              # Domain unit tests
|   |   +-- ValueObjects/
|   |   |   +-- EmailTests.cs
|   |   |   +-- MoneyTests.cs
|   |   +-- Entities/
|   |   +-- Specifications/
|   |
|   +-- Enterprise.Platform.Application.Tests/         # Application layer unit tests
|   |   +-- Features/
|   |   |   +-- Identity/
|   |   |   |   +-- RegisterUserHandlerTests.cs
|   |   |   +-- Tenants/
|   |   |       +-- CreateTenantHandlerTests.cs
|   |   +-- Behaviors/
|   |       +-- ValidationBehaviorTests.cs
|   |       +-- TransactionBehaviorTests.cs
|   |       +-- CachingBehaviorTests.cs
|   |
|   +-- Enterprise.Platform.Infrastructure.Tests/      # Infrastructure integration tests
|   |   +-- Persistence/
|   |   |   +-- UnitOfWorkTests.cs
|   |   |   +-- GenericRepositoryTests.cs
|   |   |   +-- TenantFilterTests.cs
|   |   +-- Security/
|   |       +-- EncryptionTests.cs
|   |
|   +-- Enterprise.Platform.Api.Tests/                 # API integration tests
|   |   +-- Utilities/
|   |   |   +-- CustomApiFactory.cs                    # WebApplicationFactory<Program>
|   |   |   +-- TestAuthHandler.cs                     # Fake auth for tests
|   |   +-- Endpoints/
|   |       +-- AuthEndpointsTests.cs
|   |       +-- HealthEndpointsTests.cs
|   |
|   +-- Enterprise.Platform.Architecture.Tests/        # ArchUnit tests
|       +-- LayerDependencyTests.cs                    # Domain has no infra references
|       +-- NamingConventionTests.cs                   # Handlers end with "Handler", etc.
|
+-- docker/
|   +-- Dockerfile.api                                 # Multi-stage build for API
|   +-- Dockerfile.bff                                 # Multi-stage build for BFF
|   +-- Dockerfile.worker                              # Multi-stage build for Worker
|   +-- docker-compose.yml                             # Local dev: API + SQL + Redis + Seq
|   +-- docker-compose.override.yml                    # Dev overrides
|   +-- .dockerignore
|
+-- infra/                                             # Infrastructure as Code
|   +-- bicep/                                         # Azure Bicep templates
|   |   +-- main.bicep                                 # Orchestration template
|   |   +-- modules/
|   |       +-- sql.bicep                              # Azure SQL
|   |       +-- keyvault.bicep                         # Key Vault
|   |       +-- appservice.bicep                       # App Service
|   |       +-- redis.bicep                            # Azure Cache for Redis
|   |       +-- storage.bicep                          # Blob Storage
|   |       +-- appconfig.bicep                        # App Configuration
|   +-- terraform/                                     # Alternative: Terraform
|       +-- main.tf
|       +-- variables.tf
|
+-- .github/                                           # CI/CD
|   +-- workflows/
|       +-- ci.yml                                     # Build + test + lint
|       +-- cd-staging.yml                             # Deploy to staging
|       +-- cd-production.yml                          # Deploy to production
|
+-- global.json                                        # .NET SDK version pin
+-- Directory.Build.props                              # Shared build properties (TFM, nullable)
+-- Directory.Packages.props                           # Central Package Management
+-- .editorconfig                                      # Code style enforcement
+-- nuget.config                                       # NuGet feed configuration
+-- Enterprise.Platform.sln                            # Solution file
+-- README.md                                          # Getting started
```

---

## 3. Project Dependency Map

```
Enterprise.Platform.Web.UI
  +-- Enterprise.Platform.Contracts
  +-- Enterprise.Platform.Shared

Enterprise.Platform.Api
  +-- Enterprise.Platform.Application
  +-- Enterprise.Platform.Infrastructure   (for DI registration only)
  +-- Enterprise.Platform.Contracts
  +-- Enterprise.Platform.Shared

Enterprise.Platform.Application
  +-- Enterprise.Platform.Domain
  +-- Enterprise.Platform.Contracts
  +-- Enterprise.Platform.Shared

Enterprise.Platform.Infrastructure
  +-- Enterprise.Platform.Domain
  +-- Enterprise.Platform.Application     (for behavior/service interfaces)
  +-- Enterprise.Platform.Contracts
  +-- Enterprise.Platform.Shared

Enterprise.Platform.Domain
  +-- Enterprise.Platform.Shared          (Result<T>, Guard, base types only)

Enterprise.Platform.Contracts
  +-- Enterprise.Platform.Shared

Enterprise.Platform.Shared
  +-- (no project references - leaf node)

Enterprise.Platform.Worker
  +-- Enterprise.Platform.Application
  +-- Enterprise.Platform.Infrastructure
  +-- Enterprise.Platform.Shared

--- Dependency Inversion ---

                 +-------------------+
                 | Enterprise.       |
                 | Platform.Domain   |  <-- Interfaces live here
                 | (zero infra deps) |
                 +-------------------+
                         ^ implements
         +---------------+---------------+
         |               |               |
+----------------+ +-------------+ +----------+
| Application    | | Infra       | | Api      |
| (business)     | | (database,  | | (host)   |
|                | |  services)  | |          |
+----------------+ +-------------+ +----------+
```

---

## 4. Scaffold Script

> **IMPORTANT**: Review and update this script before running.
> Run from the parent directory where you want `Enterprise.Platform/` created.

```bash
#!/bin/bash
# ==============================================================================
# Enterprise.Platform - Solution Scaffold Script
# ==============================================================================
# Target:  .NET 10 + Angular 21 | Azure-first | Clean Architecture + CQRS
# Run:     bash master-script.sh
# Verified: SDK 10.0.103, Node 24, npm 11 (2026-04-17) -> 13/13 projects build
#           with 0 warnings, 0 errors.
#
# Known pitfalls already handled in this script (see inline comments for why):
#   * CPM vs template-baked <PackageReference Version="..."/>  (NU1008) -> step 11a
#   * OpenTelemetry.Instrumentation.EntityFrameworkCore 1.0.0-beta.15 missing
#     on nuget.org (NU1603) -> pinned to 1.10.0-beta.1 in Directory.Packages.props
#   * Azure.Identity 1.13.2 gets transitively downgraded by SqlClient (NU1605)
#     -> pinned to 1.14.2
#   * Microsoft.AspNetCore.DataProtection.AzureKeyVault 3.1.24 is obsolete and
#     pulls vulnerable System.Security.Cryptography.Xml (NU1903)
#     -> replaced with Azure.Extensions.AspNetCore.DataProtection.Keys 1.5.1
#   * NuGetAuditMode=all + TreatWarningsAsErrors turns MS transitive advisories
#     into build errors -> Directory.Build.props sets audit mode to 'direct'
#   * webapi Program.cs inlines WeatherForecast (trips CA1852) and worker
#     Program.cs references the deleted Worker.cs -> step 11b rewrites both
# ==============================================================================

set -euo pipefail

# -------------------------------------------------------
# CONFIGURATION - Update these before running
# -------------------------------------------------------
SOLUTION_NAME="Enterprise.Platform"
ROOT_DIR="$(pwd)/${SOLUTION_NAME}"
DOTNET_VERSION="net10.0"
ANGULAR_VERSION="21"

echo "============================================="
echo " Scaffolding: ${SOLUTION_NAME}"
echo " Target: ${DOTNET_VERSION} + Angular ${ANGULAR_VERSION}"
echo " Location: ${ROOT_DIR}"
echo "============================================="

# -------------------------------------------------------
# 0. Create root directory + solution
# -------------------------------------------------------
mkdir -p "${ROOT_DIR}"
cd "${ROOT_DIR}"

dotnet new sln -n "${SOLUTION_NAME}"

# -------------------------------------------------------
# 1. Create global.json (pin SDK version)
# -------------------------------------------------------
cat > global.json << 'GLOBALEOF'
{
  "sdk": {
    "version": "10.0.100",
    "rollForward": "latestFeature",
    "allowPrerelease": true
  }
}
GLOBALEOF

# -------------------------------------------------------
# 2. Create Directory.Build.props (shared build config)
# -------------------------------------------------------
cat > Directory.Build.props << 'BUILDEOF'
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <AnalysisLevel>latest-recommended</AnalysisLevel>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    <NuGetAudit>true</NuGetAudit>
    <NuGetAuditLevel>moderate</NuGetAuditLevel>
    <!-- NOTE: set to 'direct' because transitive advisories from Microsoft packages
         (e.g. System.Security.Cryptography.Xml 9.0.0 pulled via auth stack) combined
         with TreatWarningsAsErrors=true would block the build. Re-enable 'all' only
         after pinning overrides for every flagged transitive. -->
    <NuGetAuditMode>direct</NuGetAuditMode>
  </PropertyGroup>
</Project>
BUILDEOF

# -------------------------------------------------------
# 3. Create Directory.Packages.props (central pkg mgmt)
#    NOTE: Update versions to latest stable when running
# -------------------------------------------------------
cat > Directory.Packages.props << 'PKGEOF'
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <!-- EF Core -->
    <PackageVersion Include="Microsoft.EntityFrameworkCore" Version="10.0.0" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.0.0" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.Tools" Version="10.0.0" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.0" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.InMemory" Version="10.0.0" />

    <!-- Identity & Auth -->
    <PackageVersion Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="10.0.0" />
    <PackageVersion Include="Microsoft.AspNetCore.Authentication.OpenIdConnect" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Identity.Web" Version="3.5.0" />

    <!-- Validation -->
    <PackageVersion Include="FluentValidation" Version="11.11.0" />
    <PackageVersion Include="FluentValidation.DependencyInjectionExtensions" Version="11.11.0" />

    <!-- Object Mapping (DtoGen emits Mapster TypeAdapterConfigs per D2 in Foundation TODO) -->
    <PackageVersion Include="Mapster" Version="7.4.0" />
    <PackageVersion Include="Mapster.DependencyInjection" Version="1.0.1" />

    <!-- Resilience -->
    <PackageVersion Include="Microsoft.Extensions.Http.Resilience" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Extensions.Resilience" Version="10.0.0" />

    <!-- Hosting (Worker Service template requires this under CPM) -->
    <PackageVersion Include="Microsoft.Extensions.Hosting" Version="10.0.3" />

    <!-- Observability -->
    <PackageVersion Include="OpenTelemetry.Extensions.Hosting" Version="1.12.0" />
    <PackageVersion Include="OpenTelemetry.Instrumentation.AspNetCore" Version="1.12.0" />
    <!-- Note: 1.0.0-beta.15 of OTel EF instrumentation was never published; 1.10.0-beta.1 is the oldest beta on nuget.org -->
    <PackageVersion Include="OpenTelemetry.Instrumentation.EntityFrameworkCore" Version="1.10.0-beta.1" />
    <PackageVersion Include="OpenTelemetry.Instrumentation.Http" Version="1.12.0" />
    <PackageVersion Include="OpenTelemetry.Instrumentation.SqlClient" Version="1.10.0-beta.1" />
    <PackageVersion Include="OpenTelemetry.Exporter.OpenTelemetryProtocol" Version="1.12.0" />

    <!-- Caching -->
    <PackageVersion Include="Microsoft.Extensions.Caching.StackExchangeRedis" Version="10.0.0" />

    <!-- API -->
    <PackageVersion Include="Asp.Versioning.Http" Version="8.1.0" />
    <PackageVersion Include="Swashbuckle.AspNetCore" Version="7.2.0" />
    <!-- 10.0.3 matches the 'dotnet new webapi' template shipped with SDK 10.0.103 -->
    <PackageVersion Include="Microsoft.AspNetCore.OpenApi" Version="10.0.3" />

    <!-- Azure -->
    <!-- Azure.Identity must be >=1.14.2 to satisfy Microsoft.Data.SqlClient 6.1.1 transitive (NU1605) -->
    <PackageVersion Include="Azure.Identity" Version="1.14.2" />
    <PackageVersion Include="Azure.Extensions.AspNetCore.Configuration.Secrets" Version="1.4.0" />
    <PackageVersion Include="Azure.Storage.Blobs" Version="12.23.0" />
    <PackageVersion Include="Microsoft.Extensions.Configuration.AzureAppConfiguration" Version="8.1.0" />

    <!-- Background Jobs -->
    <PackageVersion Include="Hangfire.Core" Version="1.8.17" />
    <PackageVersion Include="Hangfire.SqlServer" Version="1.8.17" />
    <PackageVersion Include="Hangfire.AspNetCore" Version="1.8.17" />

    <!-- Data Protection (KV-backed key ring) -->
    <!-- Microsoft.AspNetCore.DataProtection.AzureKeyVault 3.1.24 is obsolete and
         pulls vulnerable System.Security.Cryptography.Xml 9.0.0 (NU1903).
         Azure.Extensions.AspNetCore.DataProtection.Keys is the modern replacement. -->
    <PackageVersion Include="Azure.Extensions.AspNetCore.DataProtection.Keys" Version="1.5.1" />
    <PackageVersion Include="Azure.Security.KeyVault.Keys" Version="4.7.0" />

    <!-- Logging -->
    <PackageVersion Include="Serilog.AspNetCore" Version="9.0.0" />
    <PackageVersion Include="Serilog.Sinks.Console" Version="6.0.0" />
    <PackageVersion Include="Serilog.Sinks.Seq" Version="9.0.0" />
    <PackageVersion Include="Serilog.Enrichers.Environment" Version="3.0.1" />
    <PackageVersion Include="Serilog.Enrichers.Thread" Version="4.0.0" />

    <!-- Testing (versions match 'dotnet new xunit' template on SDK 10.0.103) -->
    <PackageVersion Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />
    <PackageVersion Include="xunit" Version="2.9.3" />
    <PackageVersion Include="xunit.runner.visualstudio" Version="3.1.4" />
    <PackageVersion Include="coverlet.collector" Version="6.0.4" />
    <PackageVersion Include="Moq" Version="4.20.72" />
    <PackageVersion Include="FluentAssertions" Version="7.1.0" />
    <PackageVersion Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.0" />
    <PackageVersion Include="NetArchTest.Rules" Version="1.3.2" />
    <PackageVersion Include="Bogus" Version="35.6.1" />
  </ItemGroup>
</Project>
PKGEOF

# -------------------------------------------------------
# 4. Create .editorconfig
# -------------------------------------------------------
cat > .editorconfig << 'EDITOREOF'
root = true

[*]
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.{cs,csx}]
# Organize usings
dotnet_sort_system_directives_first = true
dotnet_separate_import_directive_groups = false

# this. preferences
dotnet_style_qualification_for_field = false:warning
dotnet_style_qualification_for_property = false:warning
dotnet_style_qualification_for_method = false:warning
dotnet_style_qualification_for_event = false:warning

# var preferences
csharp_style_var_for_built_in_types = false:suggestion
csharp_style_var_when_type_is_apparent = true:suggestion
csharp_style_var_elsewhere = true:suggestion

# Expression-bodied members
csharp_style_expression_bodied_methods = when_on_single_line:suggestion
csharp_style_expression_bodied_constructors = false:suggestion
csharp_style_expression_bodied_properties = true:suggestion

# Naming conventions
dotnet_naming_rule.private_fields_should_be_camel_case.severity = warning
dotnet_naming_rule.private_fields_should_be_camel_case.symbols = private_fields
dotnet_naming_rule.private_fields_should_be_camel_case.style = camel_case_underscore
dotnet_naming_symbols.private_fields.applicable_kinds = field
dotnet_naming_symbols.private_fields.applicable_accessibilities = private
dotnet_naming_style.camel_case_underscore.required_prefix = _
dotnet_naming_style.camel_case_underscore.capitalization = camel_case

dotnet_naming_rule.interfaces_should_begin_with_i.severity = warning
dotnet_naming_rule.interfaces_should_begin_with_i.symbols = interfaces
dotnet_naming_rule.interfaces_should_begin_with_i.style = begins_with_i
dotnet_naming_symbols.interfaces.applicable_kinds = interface
dotnet_naming_style.begins_with_i.required_prefix = I
dotnet_naming_style.begins_with_i.capitalization = pascal_case

[*.{json,yml,yaml}]
indent_size = 2

[*.md]
trim_trailing_whitespace = false
EDITOREOF

# -------------------------------------------------------
# 5. Create nuget.config
# -------------------------------------------------------
cat > nuget.config << 'NUGETEOF'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
  <packageSourceMapping>
    <packageSource key="nuget.org">
      <package pattern="*" />
    </packageSource>
  </packageSourceMapping>
</configuration>
NUGETEOF

# -------------------------------------------------------
# 6. Create source directory structure
# -------------------------------------------------------
mkdir -p src/{UI,API,Core,Infrastructure,Contracts,Batch}

# ==============================================================================
# 7. CREATE PROJECTS
# ==============================================================================

# --- 7.1 Shared (leaf node - no references) ---
dotnet new classlib -n "${SOLUTION_NAME}.Shared" -o "src/Contracts/${SOLUTION_NAME}.Shared"
dotnet sln add "src/Contracts/${SOLUTION_NAME}.Shared"

# --- 7.2 Contracts (depends on Shared) ---
dotnet new classlib -n "${SOLUTION_NAME}.Contracts" -o "src/Contracts/${SOLUTION_NAME}.Contracts"
dotnet sln add "src/Contracts/${SOLUTION_NAME}.Contracts"
dotnet add "src/Contracts/${SOLUTION_NAME}.Contracts" reference "src/Contracts/${SOLUTION_NAME}.Shared"

# --- 7.3 Domain (depends on Shared only) ---
dotnet new classlib -n "${SOLUTION_NAME}.Domain" -o "src/Core/${SOLUTION_NAME}.Domain"
dotnet sln add "src/Core/${SOLUTION_NAME}.Domain"
dotnet add "src/Core/${SOLUTION_NAME}.Domain" reference "src/Contracts/${SOLUTION_NAME}.Shared"

# --- 7.4 Application (depends on Domain, Contracts, Shared) ---
dotnet new classlib -n "${SOLUTION_NAME}.Application" -o "src/Core/${SOLUTION_NAME}.Application"
dotnet sln add "src/Core/${SOLUTION_NAME}.Application"
dotnet add "src/Core/${SOLUTION_NAME}.Application" reference "src/Core/${SOLUTION_NAME}.Domain"
dotnet add "src/Core/${SOLUTION_NAME}.Application" reference "src/Contracts/${SOLUTION_NAME}.Contracts"
dotnet add "src/Core/${SOLUTION_NAME}.Application" reference "src/Contracts/${SOLUTION_NAME}.Shared"

# --- 7.5 Infrastructure (depends on Domain, Application, Contracts, Shared) ---
dotnet new classlib -n "${SOLUTION_NAME}.Infrastructure" -o "src/Infrastructure/${SOLUTION_NAME}.Infrastructure"
dotnet sln add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure"
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" reference "src/Core/${SOLUTION_NAME}.Domain"
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" reference "src/Core/${SOLUTION_NAME}.Application"
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" reference "src/Contracts/${SOLUTION_NAME}.Contracts"
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" reference "src/Contracts/${SOLUTION_NAME}.Shared"

# --- 7.6 API (depends on Application, Infrastructure, Contracts, Shared) ---
dotnet new webapi -n "${SOLUTION_NAME}.Api" -o "src/API/${SOLUTION_NAME}.Api" --use-minimal-apis
dotnet sln add "src/API/${SOLUTION_NAME}.Api"
dotnet add "src/API/${SOLUTION_NAME}.Api" reference "src/Core/${SOLUTION_NAME}.Application"
dotnet add "src/API/${SOLUTION_NAME}.Api" reference "src/Infrastructure/${SOLUTION_NAME}.Infrastructure"
dotnet add "src/API/${SOLUTION_NAME}.Api" reference "src/Contracts/${SOLUTION_NAME}.Contracts"
dotnet add "src/API/${SOLUTION_NAME}.Api" reference "src/Contracts/${SOLUTION_NAME}.Shared"

# --- 7.7 BFF (depends on Contracts, Shared) ---
dotnet new mvc -n "${SOLUTION_NAME}.Web.UI" -o "src/UI/${SOLUTION_NAME}.Web.UI"
dotnet sln add "src/UI/${SOLUTION_NAME}.Web.UI"
dotnet add "src/UI/${SOLUTION_NAME}.Web.UI" reference "src/Contracts/${SOLUTION_NAME}.Contracts"
dotnet add "src/UI/${SOLUTION_NAME}.Web.UI" reference "src/Contracts/${SOLUTION_NAME}.Shared"

# --- 7.8 Worker Service (depends on Application, Infrastructure, Shared) ---
dotnet new worker -n "${SOLUTION_NAME}.Worker" -o "src/Batch/${SOLUTION_NAME}.Worker"
dotnet sln add "src/Batch/${SOLUTION_NAME}.Worker"
dotnet add "src/Batch/${SOLUTION_NAME}.Worker" reference "src/Core/${SOLUTION_NAME}.Application"
dotnet add "src/Batch/${SOLUTION_NAME}.Worker" reference "src/Infrastructure/${SOLUTION_NAME}.Infrastructure"
dotnet add "src/Batch/${SOLUTION_NAME}.Worker" reference "src/Contracts/${SOLUTION_NAME}.Shared"

# ==============================================================================
# 8. CREATE TEST PROJECTS
# ==============================================================================

mkdir -p tests

# --- 8.1 Domain Tests ---
dotnet new xunit -n "${SOLUTION_NAME}.Domain.Tests" -o "tests/${SOLUTION_NAME}.Domain.Tests"
dotnet sln add "tests/${SOLUTION_NAME}.Domain.Tests"
dotnet add "tests/${SOLUTION_NAME}.Domain.Tests" reference "src/Core/${SOLUTION_NAME}.Domain"

# --- 8.2 Application Tests ---
dotnet new xunit -n "${SOLUTION_NAME}.Application.Tests" -o "tests/${SOLUTION_NAME}.Application.Tests"
dotnet sln add "tests/${SOLUTION_NAME}.Application.Tests"
dotnet add "tests/${SOLUTION_NAME}.Application.Tests" reference "src/Core/${SOLUTION_NAME}.Application"
dotnet add "tests/${SOLUTION_NAME}.Application.Tests" reference "src/Infrastructure/${SOLUTION_NAME}.Infrastructure"

# --- 8.3 Infrastructure Tests ---
dotnet new xunit -n "${SOLUTION_NAME}.Infrastructure.Tests" -o "tests/${SOLUTION_NAME}.Infrastructure.Tests"
dotnet sln add "tests/${SOLUTION_NAME}.Infrastructure.Tests"
dotnet add "tests/${SOLUTION_NAME}.Infrastructure.Tests" reference "src/Infrastructure/${SOLUTION_NAME}.Infrastructure"

# --- 8.4 API Integration Tests ---
dotnet new xunit -n "${SOLUTION_NAME}.Api.Tests" -o "tests/${SOLUTION_NAME}.Api.Tests"
dotnet sln add "tests/${SOLUTION_NAME}.Api.Tests"
dotnet add "tests/${SOLUTION_NAME}.Api.Tests" reference "src/API/${SOLUTION_NAME}.Api"

# --- 8.5 Architecture Tests ---
dotnet new xunit -n "${SOLUTION_NAME}.Architecture.Tests" -o "tests/${SOLUTION_NAME}.Architecture.Tests"
dotnet sln add "tests/${SOLUTION_NAME}.Architecture.Tests"
dotnet add "tests/${SOLUTION_NAME}.Architecture.Tests" reference "src/Core/${SOLUTION_NAME}.Domain"
dotnet add "tests/${SOLUTION_NAME}.Architecture.Tests" reference "src/Core/${SOLUTION_NAME}.Application"
dotnet add "tests/${SOLUTION_NAME}.Architecture.Tests" reference "src/Infrastructure/${SOLUTION_NAME}.Infrastructure"

# ==============================================================================
# 9. ADD NUGET PACKAGES TO PROJECTS
# ==============================================================================

# --- 9.1 Shared (zero packages - pure C#) ---
# No packages needed

# --- 9.2 Contracts ---
# No packages needed (POCOs only)

# --- 9.3 Domain ---
# No packages needed (pure domain, zero dependencies)

# --- 9.4 Application ---
dotnet add "src/Core/${SOLUTION_NAME}.Application" package FluentValidation
dotnet add "src/Core/${SOLUTION_NAME}.Application" package FluentValidation.DependencyInjectionExtensions

# --- 9.5 Infrastructure ---
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.EntityFrameworkCore
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.EntityFrameworkCore.SqlServer
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.EntityFrameworkCore.Tools
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.AspNetCore.Authentication.JwtBearer
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.AspNetCore.Authentication.OpenIdConnect
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.Extensions.Http.Resilience
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.Extensions.Resilience
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.Extensions.Caching.StackExchangeRedis
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package OpenTelemetry.Extensions.Hosting
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package OpenTelemetry.Instrumentation.AspNetCore
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package OpenTelemetry.Instrumentation.EntityFrameworkCore
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package OpenTelemetry.Instrumentation.Http
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package OpenTelemetry.Instrumentation.SqlClient
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package OpenTelemetry.Exporter.OpenTelemetryProtocol
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Azure.Identity
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Azure.Extensions.AspNetCore.Configuration.Secrets
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Azure.Storage.Blobs
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Azure.Security.KeyVault.Keys
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Hangfire.Core
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Hangfire.SqlServer
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Serilog.AspNetCore
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Serilog.Sinks.Console
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Serilog.Sinks.Seq
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Serilog.Enrichers.Environment
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Serilog.Enrichers.Thread

# --- 9.6 API ---
dotnet add "src/API/${SOLUTION_NAME}.Api" package Asp.Versioning.Http
dotnet add "src/API/${SOLUTION_NAME}.Api" package Swashbuckle.AspNetCore
dotnet add "src/API/${SOLUTION_NAME}.Api" package Microsoft.AspNetCore.OpenApi
dotnet add "src/API/${SOLUTION_NAME}.Api" package Hangfire.AspNetCore
dotnet add "src/API/${SOLUTION_NAME}.Api" package Serilog.AspNetCore

# --- 9.7 BFF ---
dotnet add "src/UI/${SOLUTION_NAME}.Web.UI" package Microsoft.AspNetCore.Authentication.JwtBearer
dotnet add "src/UI/${SOLUTION_NAME}.Web.UI" package Microsoft.AspNetCore.Authentication.OpenIdConnect
dotnet add "src/UI/${SOLUTION_NAME}.Web.UI" package Serilog.AspNetCore

# --- 9.8 Worker ---
dotnet add "src/Batch/${SOLUTION_NAME}.Worker" package Hangfire.Core
dotnet add "src/Batch/${SOLUTION_NAME}.Worker" package Hangfire.SqlServer
dotnet add "src/Batch/${SOLUTION_NAME}.Worker" package Serilog.AspNetCore

# --- 9.9 Test Projects ---
for TEST_PROJ in \
  "tests/${SOLUTION_NAME}.Domain.Tests" \
  "tests/${SOLUTION_NAME}.Application.Tests" \
  "tests/${SOLUTION_NAME}.Infrastructure.Tests" \
  "tests/${SOLUTION_NAME}.Api.Tests" \
  "tests/${SOLUTION_NAME}.Architecture.Tests"; do
  dotnet add "${TEST_PROJ}" package Moq
  dotnet add "${TEST_PROJ}" package FluentAssertions
  dotnet add "${TEST_PROJ}" package Bogus
done

dotnet add "tests/${SOLUTION_NAME}.Api.Tests" package Microsoft.AspNetCore.Mvc.Testing
dotnet add "tests/${SOLUTION_NAME}.Infrastructure.Tests" package Microsoft.EntityFrameworkCore.InMemory
dotnet add "tests/${SOLUTION_NAME}.Architecture.Tests" package NetArchTest.Rules

# ==============================================================================
# 10. CREATE FOLDER STRUCTURES INSIDE PROJECTS
# ==============================================================================

# --- 10.1 Shared ---
SHARED="src/Contracts/${SOLUTION_NAME}.Shared"
mkdir -p "${SHARED}"/{Results,Guards,Extensions,Constants,Enumerations}

# --- 10.2 Contracts ---
CONTRACTS="src/Contracts/${SOLUTION_NAME}.Contracts"
mkdir -p "${CONTRACTS}"/{DTOs,Requests,Responses,Settings}

# --- 10.3 Domain ---
DOMAIN="src/Core/${SOLUTION_NAME}.Domain"
mkdir -p "${DOMAIN}"/{Entities,ValueObjects,Aggregates,Events,Specifications,Interfaces,Enumerations,Exceptions}

# --- 10.4 Application ---
APP="src/Core/${SOLUTION_NAME}.Application"
mkdir -p "${APP}"/Abstractions/{Messaging,Behaviors,Persistence}
mkdir -p "${APP}"/Behaviors
mkdir -p "${APP}"/Dispatcher
mkdir -p "${APP}"/Features/Identity/{Commands,Queries,Events,Services}
mkdir -p "${APP}"/Features/Tenants/{Commands,Queries,Events}
mkdir -p "${APP}"/Features/AuditLog/Queries
mkdir -p "${APP}"/Common/{Interfaces,Models,Extensions,Mappings}

# --- 10.5 Infrastructure ---
INFRA="src/Infrastructure/${SOLUTION_NAME}.Infrastructure"
mkdir -p "${INFRA}"/Persistence/{Configurations,Interceptors,Migrations,Seeding}
mkdir -p "${INFRA}"/Identity/{OAuth,Authorization,Services}
mkdir -p "${INFRA}"/Caching
mkdir -p "${INFRA}"/Messaging/{Outbox,DomainEvents,IntegrationEvents}
mkdir -p "${INFRA}"/Resilience
mkdir -p "${INFRA}"/Observability
mkdir -p "${INFRA}"/Security/DataEncryption
mkdir -p "${INFRA}"/BackgroundJobs
mkdir -p "${INFRA}"/ExternalServices
mkdir -p "${INFRA}"/FileStorage
mkdir -p "${INFRA}"/Email
mkdir -p "${INFRA}"/FeatureFlags
mkdir -p "${INFRA}"/MultiTenancy

# --- 10.6 API ---
API="src/API/${SOLUTION_NAME}.Api"
mkdir -p "${API}"/Endpoints/v1
mkdir -p "${API}"/{Middleware,Filters,Configuration,Extensions}

# --- 10.7 BFF ---
BFF="src/UI/${SOLUTION_NAME}.Web.UI"
mkdir -p "${BFF}"/{Controllers,Configuration}
# Angular will be scaffolded separately via ng new

# --- 10.8 Worker ---
WORKER="src/Batch/${SOLUTION_NAME}.Worker"
mkdir -p "${WORKER}"/Jobs

# --- 10.9 Test folders ---
mkdir -p "tests/${SOLUTION_NAME}.Domain.Tests"/{ValueObjects,Entities,Specifications}
mkdir -p "tests/${SOLUTION_NAME}.Application.Tests"/{Features/Identity,Features/Tenants,Behaviors}
mkdir -p "tests/${SOLUTION_NAME}.Infrastructure.Tests"/{Persistence,Security}
mkdir -p "tests/${SOLUTION_NAME}.Api.Tests"/{Utilities,Endpoints}
mkdir -p "tests/${SOLUTION_NAME}.Architecture.Tests"

# --- 10.10 Docker ---
mkdir -p docker

# --- 10.11 Infrastructure as Code ---
mkdir -p infra/{bicep/modules,terraform}

# --- 10.12 GitHub Actions ---
mkdir -p .github/workflows

# ==============================================================================
# 11. CLEANUP DEFAULT FILES (remove auto-generated Class1.cs, etc.)
# ==============================================================================

# Remove default Class1.cs from class libraries
find src -name "Class1.cs" -delete 2>/dev/null || true

# Remove default WeatherForecast files from webapi template (separate files only;
# the SDK 10 minimal-API template inlines WeatherForecast into Program.cs, which
# section 11b rewrites)
find src -name "WeatherForecast*" -delete 2>/dev/null || true

# Remove default Worker.cs (we'll create our own)
find src/Batch -name "Worker.cs" -delete 2>/dev/null || true

# Remove auto-generated Controllers from MVC template (we'll create our own)
find "src/UI" -path "*/Controllers/HomeController.cs" -delete 2>/dev/null || true

# Remove the .http smoke-test file that ships with the webapi template
find "src/API" -name "*.http" -delete 2>/dev/null || true

# ==============================================================================
# 11a. STRIP INLINE VERSION ATTRIBUTES FROM TEMPLATE-GENERATED CSPROJ FILES
#
#  The dotnet templates (webapi, worker, xunit) bake in <PackageReference
#  Include="..." Version="..."/>. Under Central Package Management (CPM) a
#  PackageReference MUST NOT carry Version= — that belongs on the matching
#  PackageVersion in Directory.Packages.props (NU1008). We strip the Version
#  attribute in-place. Every bundled package name is already registered in
#  Directory.Packages.props above.
# ==============================================================================

echo ""
echo "============================================="
echo " Stripping inline PackageReference versions..."
echo "============================================="

# sed is portable enough; -i'' keeps it working on both GNU and BSD sed
find src tests -name "*.csproj" -print0 | while IFS= read -r -d '' CSPROJ; do
  sed -i'.bak' -E 's|(<PackageReference Include="[^"]+") Version="[^"]+"|\1|g' "${CSPROJ}"
  rm -f "${CSPROJ}.bak"
done

# ==============================================================================
# 11b. REPLACE TEMPLATE Program.cs STUBS WITH NEUTRAL PLACEHOLDERS
#
#  The webapi template's Program.cs inlines a WeatherForecast endpoint + record
#  that fails CA1852 (sealed) under TreatWarningsAsErrors. The worker template's
#  Program.cs references `using <Project>.Worker` + AddHostedService<Worker>()
#  which breaks once we delete Worker.cs in step 11. We overwrite both with
#  minimal stubs so the solution compiles cleanly; real wiring happens when the
#  Infrastructure DI registration + endpoint groups are implemented.
# ==============================================================================

cat > "src/API/${SOLUTION_NAME}.Api/Program.cs" << 'APIPROGEOF'
var builder = WebApplication.CreateBuilder(args);

// Service registration, middleware, and endpoint groups are configured by
// ServiceCollectionExtensions / WebApplicationExtensions in later phases.
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.Run();
APIPROGEOF

cat > "src/Batch/${SOLUTION_NAME}.Worker/Program.cs" << 'WORKERPROGEOF'
var builder = Host.CreateApplicationBuilder(args);

// Hosted services, background jobs, and DI wiring are registered by later phases
// (Infrastructure.DependencyInjection + Worker/Jobs) per Docs/Architecture/10.

var host = builder.Build();
host.Run();
WORKERPROGEOF

# ==============================================================================
# 12. CREATE PLACEHOLDER .gitkeep FILES
#     (keeps empty directories in git)
# ==============================================================================

find . -type d -empty -not -path "./.git/*" -exec touch {}/.gitkeep \;

# ==============================================================================
# 13. CREATE .gitignore
# ==============================================================================

cat > .gitignore << 'GITIGNOREEOF'
## .NET
bin/
obj/
*.user
*.suo
*.cache
*.vs/
*.DotSettings.user

## IDE
.idea/
.vscode/
*.swp

## Build
[Dd]ebug/
[Rr]elease/
publish/
out/

## NuGet
*.nupkg
**/packages/

## Secrets
appsettings.*.local.json
*.pfx
*.key

## Node (Angular)
node_modules/
dist/
.angular/
npm-debug.log*
yarn-error.log*

## Docker
docker-compose.override.local.yml

## OS
.DS_Store
Thumbs.db

## Test results
TestResults/
coverage/
*.trx
GITIGNOREEOF

# ==============================================================================
# 14. VERIFY BUILD
#
#  IMPORTANT: do NOT pipe these through `tee` — `set -euo pipefail` will
#  only trip the pipeline if the LAST command returns non-zero, and tee
#  almost always returns 0. Keep them unpiped so a restore or build
#  failure aborts the script immediately.
# ==============================================================================

echo ""
echo "============================================="
echo " Restoring packages..."
echo "============================================="
dotnet restore

echo ""
echo "============================================="
echo " Building solution..."
echo "============================================="
dotnet build --no-restore

echo ""
echo "============================================="
echo " SCAFFOLD COMPLETE"
echo "============================================="
echo ""
echo " Solution: ${ROOT_DIR}/${SOLUTION_NAME}.sln"
echo " Projects: $(find src -name '*.csproj' | wc -l) source + $(find tests -name '*.csproj' | wc -l) test"
echo ""
echo " Next steps:"
echo "   1. Review and customize Directory.Packages.props versions"
echo "   2. cd ${ROOT_DIR} && dotnet build"
echo "   3. Start implementing foundation files (see architecture docs)"
echo "   4. Scaffold Angular: cd src/UI/${SOLUTION_NAME}.Web.UI && ng new ClientApp --style=scss --routing"
echo ""
```

---

## 5. What Each Project Contains

### 5.1 Enterprise.Platform.Shared (Leaf Node)

**Purpose**: Shared kernel referenced by every project. Contains types that are too fundamental to belong to any single layer.

| Folder | Contents | Why Here |
|--------|----------|----------|
| `Results/` | `Result<T>`, `Error`, `ErrorCodes` | Every layer needs Result pattern for typed errors |
| `Guards/` | `Guard.Against.Null/Empty/OutOfRange` | Defensive checks everywhere |
| `Extensions/` | String, DateTime, Enumerable helpers | Universal utility methods |
| `Constants/` | `HttpHeaderNames`, `ClaimTypes`, `AppConstants` | Shared across API + BFF + Application |
| `Enumerations/` | `SortDirection`, `FilterOperator`, `TenantIsolationMode` | Cross-layer enum types |

### 5.2 Enterprise.Platform.Domain (Zero Dependencies)

**Purpose**: Pure domain model. No NuGet packages. No infrastructure. Only depends on Shared.

| Folder | Contents | Why Here |
|--------|----------|----------|
| `Entities/` | `BaseEntity`, `AuditableEntity`, `TenantAuditableEntity` | Base classes for all domain entities |
| `ValueObjects/` | `Email`, `PhoneNumber`, `Money`, `Address`, `DateRange` | Immutable, validated domain primitives |
| `Aggregates/` | `AggregateRoot` base class | Domain event collection management |
| `Events/` | `IDomainEvent`, `IIntegrationEvent` | Event contracts (no implementations) |
| `Specifications/` | `ISpecification<T>`, `Specification<T>` | Composable query criteria |
| `Interfaces/` | `IGenericRepository`, `IUnitOfWork`, `IReadDbContext`, `IWriteDbContext`, `ICurrentUserService`, `ICurrentTenantService`, `IAuditableEntity`, `ISoftDeletable`, `ITenantEntity` | Abstractions that Infrastructure implements |
| `Enumerations/` | `Enumeration` base (smart enum) | Domain-specific enum pattern |
| `Exceptions/` | Domain exception hierarchy | `DomainException`, `EntityNotFound`, `BusinessRuleViolation`, `ConcurrencyConflict`, `AccessDenied`, `TenantMismatch` |

### 5.3 Enterprise.Platform.Application (CQRS Layer)

**Purpose**: Business logic orchestration. Commands, queries, handlers, pipeline behaviors.

| Folder | Contents | Why Here |
|--------|----------|----------|
| `Abstractions/Messaging/` | `ICommand<T>`, `IQuery<T>`, `ICommandHandler`, `IQueryHandler`, `IDispatcher` | CQRS contracts |
| `Abstractions/Behaviors/` | `IPipelineBehavior`, marker interfaces (`ITransactional`, `ICacheable`, `IIdempotent`, `IRequiresAudit`, `IRequiresDualApproval`) | Pipeline behavior contracts |
| `Behaviors/` | `LoggingBehavior`, `ValidationBehavior`, `TransactionBehavior`, `CachingBehavior`, `AuditBehavior`, `TenantFilterBehavior`, `IdempotencyBehavior` | Cross-cutting pipeline implementations (ordered 1-7) |
| `Dispatcher/` | `Dispatcher.cs` | Lightweight mediator (no MediatR dependency) |
| `Features/Identity/` | Register user, assign role, get user, list users | Identity management commands/queries |
| `Features/Tenants/` | Create tenant, get tenant | Multi-tenancy management |
| `Features/AuditLog/` | Query audit logs | Audit trail queries |
| `Common/` | `IDateTimeProvider`, `IFileStorageService`, `IEmailService`, pagination models, queryable extensions, mapping contracts | Shared application services |

### 5.4 Enterprise.Platform.Infrastructure (Implements Everything)

**Purpose**: All infrastructure concerns. Implements Domain interfaces. Only project with NuGet dependencies on EF Core, Azure, Polly, etc.

| Folder | Contents | Why Here |
|--------|----------|----------|
| `Persistence/` | `AppWriteDbContext` (tracking + audit), `AppReadDbContext` (NoTracking global), `UnitOfWork` (1-param), `GenericRepository`, EF configurations, interceptors (audit, soft-delete, tenant filter, domain events), migrations, seed data | Data access layer |
| `Identity/` | OAuth 2.1 + OIDC config, JWT token service, refresh rotation, RBAC policy provider, ABAC evaluator (commented), resource ownership handler, `CurrentUserService`, `CurrentTenantService`, login protection | Authentication + Authorization |
| `Caching/` | In-memory provider, Redis provider (commented), cache keys, invalidation service | Cache-aside pattern |
| `Messaging/` | Outbox entity + processor + cleanup, domain event dispatcher, integration event publisher (commented) | Event infrastructure |
| `Resilience/` | Polly pipelines (retry, circuit breaker, timeout), HttpClient resilience setup | Fault tolerance |
| `Observability/` | OpenTelemetry setup (tracing + metrics + OTLP), Serilog config, business metrics, PII scrubber | Monitoring + telemetry |
| `Security/` | `EncryptedStringConverter` (EF value converter), key management (Azure Key Vault), input sanitizer | Data protection |
| `BackgroundJobs/` | Base job class, audit retention job, domain job placeholders | Scheduled processing |
| `ExternalServices/` | Base external service (with resilience + logging), domain service placeholders | HTTP/SOAP/gRPC clients |
| `FileStorage/` | Azure Blob Storage, local FS (dev) | File persistence |
| `Email/` | SMTP, SendGrid (commented) | Email delivery |
| `FeatureFlags/` | Azure App Configuration (commented), feature flag constants | Runtime toggles |
| `MultiTenancy/` | Tenant resolution (header/subdomain/path), DB-per-tenant (commented), schema-per-tenant (commented), shared DB with TenantId filter (active) | Multi-tenant isolation |

### 5.5 Enterprise.Platform.Api (Host)

**Purpose**: API host. Wires DI. Defines endpoints. Configures middleware pipeline.

| Folder | Contents | Why Here |
|--------|----------|----------|
| `Endpoints/v1/` | Auth, User, Tenant, Audit, Health + domain placeholders | Minimal API endpoint groups |
| `Middleware/` | Correlation ID, global exception (RFC 7807), security headers, tenant resolution, request logging | HTTP pipeline |
| `Filters/` | Validation (FluentValidation), idempotency (Idempotency-Key header), logging | Endpoint filters |
| `Configuration/` | API versioning, rate limiting, OpenAPI/Swagger, health checks, auth, compression | Service setup |
| `Extensions/` | `ServiceCollectionExtensions`, `WebApplicationExtensions` | DI + middleware registration |

### 5.6 Enterprise.Platform.Web.UI (Browser-Facing)

**Purpose**: Backend-For-Frontend. Serves Angular SPA. Manages browser auth (JWT/OIDC). Proxies to internal API.

| Folder | Contents | Why Here |
|--------|----------|----------|
| `Controllers/` | Auth (login, OIDC callback, refresh), anti-forgery, BFF proxy | MVC controllers for BFF |
| `Configuration/` | JWT+OIDC setup, CORS, security headers (CSP, HSTS) | BFF-specific config |
| `ClientApp/` | Angular 21 SPA (scaffolded separately) | Frontend application |

### 5.7 Enterprise.Platform.Worker (Background Host)

**Purpose**: Long-running background jobs. Outbox processing, audit retention, cache warmup.

| Folder | Contents | Why Here |
|--------|----------|----------|
| `Jobs/` | Outbox processor, audit retention, cache warmup | Scheduled/recurring jobs |

### 5.8 Test Projects

| Project | Type | Focus |
|---------|------|-------|
| `Domain.Tests` | Unit | Value objects, entity invariants, specifications |
| `Application.Tests` | Unit | Handler logic, pipeline behaviors, validators |
| `Infrastructure.Tests` | Integration | UoW, repository, tenant filters, encryption |
| `Api.Tests` | Integration | Endpoint responses, auth, health checks |
| `Architecture.Tests` | Architectural | Layer dependency rules (Domain has no infra refs), naming conventions |

---

## Cross-Cutting Concepts Coverage Map

Every requirement from the architecture brief is mapped to a specific location:

| Concept | Project | Folder/File |
|---------|---------|-------------|
| **OAuth 2.1 + OIDC** | Infrastructure | `Identity/OAuth/OAuthConfiguration.cs` |
| **BFF pattern** | Web.UI | `Controllers/AuthController.cs` |
| **MFA** | Infrastructure | `Identity/Services/LoginProtectionService.cs` |
| **RBAC** | Infrastructure | `Identity/Authorization/RbacPolicyProvider.cs` |
| **ABAC** | Infrastructure | `Identity/Authorization/AbacPolicyEvaluator.cs` (commented) |
| **Policy-based auth** | Infrastructure | `Identity/Authorization/PermissionAuthorizationHandler.cs` |
| **Resource ownership** | Infrastructure | `Identity/Authorization/ResourceOwnershipHandler.cs` |
| **Multi-tenancy** | Infrastructure | `MultiTenancy/` (3 strategies) |
| **Tenant query filters** | Infrastructure | `Persistence/Interceptors/TenantQueryFilterInterceptor.cs` |
| **Secrets management** | Api | `Program.cs` (Azure Key Vault) |
| **CQRS** | Application | `Abstractions/Messaging/`, `Dispatcher/` |
| **Pipeline behaviors** | Application | `Behaviors/` (7 behaviors, ordered) |
| **Schema & migrations** | Infrastructure | `Persistence/Migrations/` (EF Core) |
| **Concurrency control** | Domain | `Entities/BaseEntity.cs` (RowVersion) |
| **Cursor pagination** | Application | `Common/Models/CursorPagedRequest.cs` |
| **Soft delete** | Domain + Infrastructure | `ISoftDeletable` + `SoftDeleteInterceptor` |
| **Caching (Redis)** | Infrastructure | `Caching/RedisCacheProvider.cs` (commented) |
| **Cache pipeline** | Application | `Behaviors/CachingBehavior.cs` |
| **Audit log** | Infrastructure | `Persistence/Interceptors/AuditableEntityInterceptor.cs` |
| **Column encryption** | Infrastructure | `Security/DataEncryption/EncryptedStringConverter.cs` |
| **API versioning** | Api | `Configuration/ApiVersioningSetup.cs` |
| **Idempotency** | Api + Application | `Filters/IdempotencyEndpointFilter.cs` + `Behaviors/IdempotencyBehavior.cs` |
| **RFC 7807 errors** | Api | `Middleware/GlobalExceptionMiddleware.cs` |
| **Rate limiting** | Api | `Configuration/RateLimitingSetup.cs` |
| **Validation** | Application | `Behaviors/ValidationBehavior.cs` (FluentValidation) |
| **CORS** | Web.UI | `Configuration/BffCorsSetup.cs` |
| **OpenAPI** | Api | `Configuration/OpenApiSetup.cs` |
| **Compression** | Api | `Configuration/CompressionSetup.cs` |
| **Resilience (Polly)** | Infrastructure | `Resilience/ResiliencePipelineSetup.cs` |
| **Health checks** | Api | `Configuration/HealthCheckSetup.cs` |
| **Graceful shutdown** | Api | `Program.cs` (host shutdown hooks) |
| **Background jobs** | Infrastructure + Worker | `BackgroundJobs/` + `Worker/Jobs/` |
| **Outbox pattern** | Infrastructure | `Messaging/Outbox/` |
| **Feature flags** | Infrastructure | `FeatureFlags/` (commented) |
| **Containerization** | docker/ | `Dockerfile.api`, `Dockerfile.bff`, `docker-compose.yml` |
| **Distributed tracing** | Infrastructure | `Observability/OpenTelemetrySetup.cs` |
| **Structured logging** | Infrastructure | `Observability/StructuredLoggingSetup.cs` |
| **PII scrubbing** | Infrastructure | `Observability/PiiScrubber.cs` |
| **Business metrics** | Infrastructure | `Observability/BusinessMetrics.cs` |
| **CI/CD** | .github/ | `workflows/ci.yml`, `cd-staging.yml`, `cd-production.yml` |
| **IaC** | infra/ | `bicep/`, `terraform/` |
| **Blue-green deploy** | .github/ | `cd-production.yml` |
| **Domain events** | Domain + Infrastructure | `Events/` + `Messaging/DomainEvents/` |
| **Integration events** | Infrastructure | `Messaging/IntegrationEvents/` (outbox-backed) |
| **Aggregate design** | Domain | `Aggregates/AggregateRoot.cs` |
| **Result pattern** | Shared | `Results/Result.cs` |
| **Vertical slices** | Application | `Features/` (per-feature folders) |
| **Specification pattern** | Domain | `Specifications/` |
| **Value objects** | Domain | `ValueObjects/` |
| **Smart enums** | Domain | `Enumerations/Enumeration.cs` |
| **Guard clauses** | Shared | `Guards/Guard.cs` |
| **Architecture tests** | Architecture.Tests | Layer dependency + naming rules |
| **Security headers** | Api | `Middleware/SecurityHeadersMiddleware.cs` |
| **XSS prevention** | Infrastructure | `Security/InputSanitizer.cs` |
| **CSRF protection** | Web.UI | `Controllers/AntiForgeryController.cs` |
| **Data retention** | Infrastructure | `BackgroundJobs/AuditRetentionJob.cs` |
