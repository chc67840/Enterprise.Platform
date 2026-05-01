// ╔═════════════════════════════════════════════════════════════════════════════╗
// ║                                                                             ║
// ║   MasterConfigModels.cs                                                     ║
// ║   ─────────────────────────                                                 ║
// ║   Canonical, consolidated .NET model surface for the entire backend.        ║
// ║                                                                             ║
// ║   This file is REFERENCE ONLY — it is excluded from the build (see          ║
// ║   <ItemGroup><Compile Remove="Docs\**\*.cs" /></ItemGroup> in any host      ║
// ║   csproj that scans Docs/) and serves as a single-page index of every       ║
// ║   contract / settings / domain primitive / DTO the platform emits.          ║
// ║                                                                             ║
// ║   Use it to:                                                                ║
// ║     • Onboard new engineers to the type surface in 30 minutes               ║
// ║     • Detect duplication when adding a new shape ("does X already exist?")  ║
// ║     • Trace a wire shape end-to-end (C# record → TS interface)              ║
// ║     • Audit drift between SPA, BFF, and Api tiers                           ║
// ║                                                                             ║
// ║   PAIRED WITH                                                               ║
// ║     Docs/Architecture/master-config.models.ts — the Angular mirror.         ║
// ║                                                                             ║
// ║   AUTHORITY                                                                 ║
// ║     Each section cites its real on-disk source-of-truth file in the         ║
// ║     header comment. When a definition here diverges from the live source,   ║
// ║     the LIVE SOURCE WINS — open a PR to update this file.                   ║
// ║                                                                             ║
// ║   GENERATED — 2026-04-30 (manual consolidation)                             ║
// ║                                                                             ║
// ╚═════════════════════════════════════════════════════════════════════════════╝
//
// ─── TABLE OF CONTENTS ───────────────────────────────────────────────────────────
//
//   FLAGS                  Cross-tier inconsistencies — read first
//   §1   Primitives        Severity / SortDirection / FilterOperator
//   §2   Base entity       BaseEntity / AuditableEntity / AggregateRoot / IAuditableEntity
//   §3   Result envelope   Result / Result<T> / Error / ErrorSeverity / ErrorCodes
//   §4   Paging            PagedRequest / PagedResult<T> / SortDescriptor / FilterDescriptor
//   §5   MediatR           ICommand / IQuery / *Handler / IPipelineBehavior
//   §6   Behavior markers  IRequiresAudit / ICacheable / IIdempotent / ITransactional
//   §7   Settings (server) AppSettings / JwtSettings / CorsSettings / DatabaseSettings / CacheSettings / ObservabilitySettings
//   §8   Chrome DTOs       NavbarConfigDto hierarchy / FooterConfigDto hierarchy
//   §9   Session + auth    SessionInfoDto / EffectivePermissions / ICurrentUserService
//   §10  Constants         HttpHeaderNames / ClaimTypes / AppConstants
//   §11  Permissions       UserPermissions (canonical template)
//   §12  Feature commands  CreateUserCommand etc. (template for new aggregates)
//
// ═════════════════════════════════════════════════════════════════════════════════
//
// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃                                FLAGS                                        ┃
// ┃        ─── KNOWN INCONSISTENCIES — RESOLVE BEFORE EXTENDING ───              ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
//
//   F1 ▸ Severity vocabulary — THREE divergent shapes:
//        • DPH UI Kit (TS)            : 'success' | 'warning' | 'danger' | 'info' | 'neutral'
//        • Chrome wire (NavBadgeDto)  : "info" | "success" | "warning" | "danger" | "secondary"
//        • .NET ErrorSeverity (enum)  : Info | Warning | Critical
//        Action — these vocabularies serve different purposes. Document the
//        intent of each ("UI badge severity" vs "error severity for logs/alerts")
//        and stop using the words interchangeably.
//
//   F2 RESOLVED 2026-04-30 (disambiguation, not consolidation) ▸
//        Re-analysis showed the two SPA types are different CONCEPTS:
//        DPH `'asc'|'desc'|null` is the UI tri-state; Core `'asc'|'desc'`
//        is the wire format. Cross-reference doc-comments now connect them.
//        Wire format from this side: PascalCase ("Asc"|"Desc") via
//        System.Text.Json default; BFF maps to camelCase for the SPA.
//
//   F3 ▸ Pagination envelope — FOUR shapes in flight:
//        • SPA generic (PagedResponse<T>)     : data/total/page/pageSize/totalPages/hasNext/hasPrev
//        • SPA users-feature (ListUsersResponse) : items/pageNumber/pageSize/totalCount
//        • .NET (PagedResult<T>)              : Items/PageNumber/PageSize/TotalCount/TotalPages
//        • .NET wire envelope (PaginationMeta inside ApiResponse.Meta) : TotalCount/PageSize/PageNumber/NextCursor/PreviousCursor
//        Action — pick ONE wire envelope. Today the user feature emits raw
//        PagedResult<T>; everything else uses ApiResponse + PaginationMeta.
//        Recommended: standardise on raw PagedResult<T> for list endpoints
//        (closer to RFC 8288); have the SPA's BaseApiService translate once
//        to the derived form so feature stores never see two shapes.
//
//   F4 ▸ Multi-tenant claim ↔ stripped reality:
//        Project description says "Multi-tenant (TenantId on everything)"
//        BUT per memory project_phase1_singletenant_done.md (2026-04-25)
//        tenancy was stripped. AuditableEntity doc-comment confirms the strip
//        ("Single-tenant: no tenant-scoped variant exists post-2026-04-25 strip").
//        Residual: NavTenantSwitcherConfigDto, TenantOptionDto stubs (always
//        Enabled=false), CorsSettings.AllowedHeaders includes "X-Tenant-ID".
//        To reintroduce: see §2 (TenantId on AuditableEntity), §9 (tenantId on
//        SessionInfoDto + ICurrentUserService), then activate chrome stubs.
//
//   F5 ▸ UserDto omits RowVersion:
//        Domain User entity has RowVersion (via BaseEntity) but the DtoGen-
//        emitted UserDto record does NOT include it. Optimistic concurrency
//        cannot round-trip end-to-end for User commands today. Either emit
//        RowVersion from DtoGen + add `version` on SPA UserDto, OR document
//        that the User aggregate forgoes optimistic concurrency.
//
//   F6 RESOLVED 2026-04-30 ▸ TS hand-mirror added at
//        `src/UI/Enterprise.Platform.Web.UI/ClientApp/src/app/core/http/http-headers.constants.ts`
//        and re-exported from `@core/http`. Callsites refactored. ▲ DRIFT
//        GUARD informal until Architecture.Tests adds a cross-tier diff.
//
//   F7 RESOLVED 2026-04-30 ▸ Promoted to
//        `src/Contracts/Enterprise.Platform.Contracts/DTOs/Auth/EffectivePermissionsDto.cs`.
//        AuthController returns the new contract DTO; obsolete
//        Web.UI.Controllers.Models.EffectivePermissions record deleted
//        (its `TenantId: null` field also dropped per F4).
//
//   F8 ▸ User permission name divergence — RESOLVED 2026-04-29:
//        Confirmed both sides now use `users.read | users.create | users.write
//        | users.activate | users.deactivate` exactly. SPA TS exports as
//        SCREAMING_SNAKE_CASE keys (USER_PERMISSIONS.WRITE), .NET as PascalCase
//        constants (UserPermissions.Write). Same string values both sides.
//
//   F9 ▸ ApiResponse<T>.Success vs Result.IsSuccess — semantic overlap:
//        ApiResponse<T> (success envelope) carries `Success = true` always
//        (sanity bit). Result/Result<T> (railway pattern) carries IsSuccess
//        as actual control flow. Endpoints typically return ApiResponse on 2xx
//        and ProblemDetailsExtended on 4xx/5xx — so the Success flag is
//        load-bearing only for 2xx-with-body responses. Keep both; document
//        the convention in §3.
//
// ═════════════════════════════════════════════════════════════════════════════════

using System.Diagnostics.CodeAnalysis;

namespace Enterprise.Platform.Docs.Architecture;

// NOTE: Every type below mirrors a real, on-disk type. Use this file as a map;
//       always resolve to the live type at the cited path before code changes.

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 1 — PRIMITIVES
// ─────────────────────────
// WHAT  : Building-block enums used by paging, errors, queries, and the .NET
//         response envelope.
// WHY   : Centralised string vocabulary survives JSON serialisation roundtrips
//         without hand-rolled mapping per feature.
// WHERE : src/Contracts/Enterprise.Platform.Shared/Enumerations/

/// <summary>
/// Sort direction (see FLAGS §F2). Serialized as a string ("Asc" / "Desc")
/// at API boundaries so casing stays stable across SPA, BFF, and Api.
/// </summary>
public enum SortDirection
{
    Asc = 0,
    Desc = 1,
}

/// <summary>
/// Operator vocabulary used by generic list queries (FilterDescriptor).
/// QueryableExtensions.ApplyFilters is the SOLE authority on operator → SQL.
/// </summary>
public enum FilterOperator
{
    Eq = 0,    // =
    Neq = 1,   // <>
    Gt = 2,    // >
    Gte = 3,   // >=
    Lt = 4,    // <
    Lte = 5,   // <=
    Like = 6,  // LIKE '%v%'
    In = 7,    // IN (...)
    Between = 8, // BETWEEN lo AND hi
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 2 — BASE ENTITY HIERARCHY
// ─────────────────────────
// WHAT  : The chain every persisted entity inherits.
//          BaseEntity → AuditableEntity → AggregateRoot
// WHY   :
//   • BaseEntity ........... Identity + concurrency token.
//   • AuditableEntity ...... Audit columns (auto-populated by interceptor).
//   • AggregateRoot ........ Domain-event collection.
// WHERE : src/Core/Enterprise.Platform.Domain/Entities/, .../Aggregates/, .../Interfaces/

/// <summary>Audit-metadata contract — populated by AuditableEntityInterceptor at SaveChangesAsync.</summary>
public interface IAuditableEntity
{
    string CreatedBy { get; set; }                  // User id or 'system'
    DateTimeOffset CreatedAt { get; set; }          // UTC instant
    string? ModifiedBy { get; set; }                // null until first update
    DateTimeOffset? ModifiedAt { get; set; }
}

/// <summary>Soft-delete contract — paired with a global query filter on the DbContext.</summary>
public interface ISoftDeletable
{
    bool IsDeleted { get; set; }
    DateTimeOffset? DeletedAt { get; set; }
    string? DeletedBy { get; set; }
}

/// <summary>
/// Root of the entity hierarchy. Identity + RowVersion (optimistic concurrency).
/// Id setter is protected so EF can bind via reflection but app code cannot.
/// </summary>
public abstract class BaseEntity : IEquatable<BaseEntity>
{
    protected BaseEntity() { Id = Guid.NewGuid(); }

    public Guid Id { get; protected set; }

    /// <summary>Optimistic-concurrency token; mismatches throw ConcurrencyConflictException via the translator.</summary>
    public byte[] RowVersion { get; set; } = [];

    public bool Equals(BaseEntity? other)
        => other is not null && GetType() == other.GetType() && Id == other.Id;
    public override bool Equals(object? obj) => Equals(obj as BaseEntity);
    public override int GetHashCode() => HashCode.Combine(GetType(), Id);
    public static bool operator ==(BaseEntity? l, BaseEntity? r) => l is null ? r is null : l.Equals(r);
    public static bool operator !=(BaseEntity? l, BaseEntity? r) => !(l == r);
}

/// <summary>
/// Every non-reference-data entity inherits from this. Audit fields populated
/// by AuditableEntityInterceptor — handlers MUST NEVER assign directly.
/// (See FLAGS §F4 for tenancy strip note.)
/// </summary>
public abstract class AuditableEntity : BaseEntity, IAuditableEntity
{
    public string CreatedBy { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public string? ModifiedBy { get; set; }
    public DateTimeOffset? ModifiedAt { get; set; }
}

/// <summary>
/// Aggregate root — the single consistency boundary external callers mutate.
/// Tracks uncommitted IDomainEvents that the infrastructure dispatches AFTER
/// SaveChangesAsync succeeds (so handlers see committed state).
/// </summary>
public abstract class AggregateRoot : AuditableEntity
{
    private readonly List<IDomainEvent> _domainEvents = [];

    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();
    protected void AddDomainEvent(IDomainEvent e) { ArgumentNullException.ThrowIfNull(e); _domainEvents.Add(e); }
    public void ClearDomainEvents() => _domainEvents.Clear();
}

/// <summary>Domain event — dispatched in-process by DomainEventDispatchInterceptor post-commit.</summary>
public interface IDomainEvent
{
    DateTimeOffset OccurredOn { get; }
}

/// <summary>Integration event — published to the message bus (separate from in-process IDomainEvent).</summary>
public interface IIntegrationEvent
{
    Guid EventId { get; }
    DateTimeOffset OccurredOn { get; }
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 3 — RESULT / ERROR ENVELOPE
// ─────────────────────────
// WHAT  : Railway-oriented result types + structured error record.
// WHY   : Application/Domain code branches on Result.IsSuccess/Failure;
//         throws are reserved for unexpected/exceptional cases.
// WHERE : src/Contracts/Enterprise.Platform.Shared/Results/

/// <summary>Severity classification for an Error (logging/alerting; see FLAGS §F1).</summary>
public enum ErrorSeverity
{
    Info = 0,       // Not a failure on its own
    Warning = 1,    // Expected, recoverable (validation, not-found, conflict)
    Critical = 2,   // Unrecoverable / unexpected — alerts oncall
}

/// <summary>
/// Immutable, transport-agnostic error record returned inside a Result/Result&lt;T&gt;.
/// </summary>
public sealed record Error(string Code, string Message, ErrorSeverity Severity = ErrorSeverity.Warning)
{
    public static readonly Error None = new(string.Empty, string.Empty, ErrorSeverity.Info);

    public static Error Validation(string m)   => new(ErrorCodes.Validation,   m, ErrorSeverity.Warning);
    public static Error NotFound(string m)     => new(ErrorCodes.NotFound,     m, ErrorSeverity.Warning);
    public static Error Conflict(string m)     => new(ErrorCodes.Conflict,     m, ErrorSeverity.Warning);
    public static Error Unauthorized(string m) => new(ErrorCodes.Unauthorized, m, ErrorSeverity.Warning);
    public static Error Forbidden(string m)    => new(ErrorCodes.Forbidden,    m, ErrorSeverity.Warning);
    public static Error Internal(string m)     => new(ErrorCodes.Internal,     m, ErrorSeverity.Critical);
}

/// <summary>Stable machine-readable error code constants (EP. prefix avoids 3rd-party collision).</summary>
public static class ErrorCodes
{
    public const string Validation   = "EP.Validation";
    public const string NotFound     = "EP.NotFound";
    public const string Conflict     = "EP.Conflict";
    public const string Forbidden    = "EP.Forbidden";
    public const string Unauthorized = "EP.Unauthorized";
    public const string Internal     = "EP.Internal";
}

/// <summary>Railway-oriented result without payload.</summary>
public class Result
{
    protected internal Result(bool isSuccess, Error error)
    {
        if (isSuccess && error != Error.None)
            throw new InvalidOperationException("Successful Result cannot carry an error.");
        if (!isSuccess && error == Error.None)
            throw new InvalidOperationException("Failed Result must carry an Error.");
        IsSuccess = isSuccess;
        Error = error;
    }

    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;
    public Error Error { get; }

    public static Result Success() => new(true, Error.None);
    public static Result Failure(Error error) => new(false, error);
    public static Result<T> Success<T>(T value) => new(value, true, Error.None);
    public static Result<T> Failure<T>(Error error) => new(default, false, error);
}

/// <summary>Railway-oriented result carrying a typed payload on success.</summary>
public sealed class Result<T> : Result
{
    private readonly T? _value;
    internal Result(T? value, bool isSuccess, Error error) : base(isSuccess, error) { _value = value; }

    [NotNull]
    public T Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException("Cannot access Value on a failed Result.");

    public static implicit operator Result<T>(T value) => Success(value);
    public static implicit operator Result<T>(Error error) => Failure<T>(error);
}

/// <summary>
/// Standard SUCCESS envelope for REST endpoints. (See FLAGS §F9.)
/// Failures use ProblemDetailsExtended instead — never overload this with error fields.
/// </summary>
public sealed class ApiResponse<T>
{
    public T? Data { get; init; }
    public bool Success { get; init; } = true;
    public ResponseMeta Meta { get; init; } = new();
    public IReadOnlyList<Error> Warnings { get; init; } = [];
}

public sealed class ResponseMeta
{
    public string? CorrelationId { get; init; }                    // Echoes X-Correlation-ID
    public DateTimeOffset ServerTime { get; init; } = DateTimeOffset.UtcNow;
    public string? ApiVersion { get; init; }
    public PaginationMeta? Pagination { get; init; }               // Only on list endpoints
}

/// <summary>Pagination summary — see FLAGS §F3 for shape divergence note.</summary>
public sealed class PaginationMeta
{
    public long? TotalCount { get; init; }                         // null when counting too expensive
    public int PageSize { get; init; }
    public int? PageNumber { get; init; }                          // Offset paging
    public string? NextCursor { get; init; }                       // Cursor paging
    public string? PreviousCursor { get; init; }
}

/// <summary>
/// Extended RFC 7807 application/problem+json shape.
/// GlobalExceptionMiddleware emits this for every failure path.
/// </summary>
public sealed class ProblemDetailsExtended
{
    public string Type { get; init; } = "about:blank";             // RFC 7807 §3.1
    public string Title { get; init; } = string.Empty;
    public int Status { get; init; }
    public string? Detail { get; init; }                            // SAFE TO LOCALIZE — never include PII / SQL / stack
    public string? Instance { get; init; }
    public string? CorrelationId { get; init; }
    public IReadOnlyList<Error> Errors { get; init; } = [];
    public IReadOnlyDictionary<string, IReadOnlyList<string>> FieldErrors { get; init; } =
        new Dictionary<string, IReadOnlyList<string>>();
    public DateTimeOffset Timestamp { get; init; } = DateTimeOffset.UtcNow;
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 4 — PAGING / SORT / FILTER (Application layer)
// ─────────────────────────
// WHAT  : Generic paging request + result + sort/filter descriptors.
// WHY   : Reused across every list query in the Application tier.
// WHERE : src/Core/Enterprise.Platform.Application/Common/Models/

/// <summary>
/// Offset-pagination parameters. Prefer CursorPagedRequest for high-cardinality lists —
/// offset gets expensive as the page number grows.
/// </summary>
public sealed class PagedRequest
{
    private int _pageNumber = AppConstants.Paging.DefaultPageNumber;
    private int _pageSize = AppConstants.Paging.DefaultPageSize;

    public int PageNumber
    {
        get => _pageNumber;
        set => _pageNumber = value < 1 ? 1 : value;
    }

    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = Math.Clamp(value, 1, AppConstants.Paging.MaxPageSize);
    }

    public IReadOnlyList<SortDescriptor> Sort { get; init; } = [];
    public IReadOnlyList<FilterDescriptor> Filters { get; init; } = [];
    public int Skip => (PageNumber - 1) * PageSize;
}

public sealed record SortDescriptor(string Field, SortDirection Direction);

public sealed record FilterDescriptor(string Field, FilterOperator Op, object? Value, object? Value2 = null);

/// <summary>
/// Offset-pagination result. TotalCount is OPTIONAL — handlers may skip
/// counting on huge tables and leave it null.
/// </summary>
public sealed class PagedResult<T>
{
    public required IReadOnlyList<T> Items { get; init; }
    public required int PageNumber { get; init; }                  // 1-based
    public required int PageSize { get; init; }
    public long? TotalCount { get; init; }                          // null = handler declined to count
    public int? TotalPages => TotalCount.HasValue && PageSize > 0
        ? (int)Math.Ceiling(TotalCount.Value / (double)PageSize)
        : null;
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 5 — MEDIATR-STYLE ABSTRACTIONS
// ─────────────────────────
// WHAT  : Marker interfaces consumed by the in-house dispatcher (we do NOT use
//         MediatR — see Architecture-Comparison-Analysis decision).
// WHY   : Handlers are routed by type; pipeline behaviors are composed via
//         marker interfaces opted into per-command.
// WHERE : src/Core/Enterprise.Platform.Application/Abstractions/Messaging/, .../Behaviors/

/// <summary>Marker — request that mutates state (no return value).</summary>
public interface ICommand { }

/// <summary>Marker — request that mutates state and returns TResult (typically Result/Result&lt;T&gt;).</summary>
public interface ICommand<TResult> { }

/// <summary>Marker — read-only request returning TResult. Eligible for ICacheable.</summary>
public interface IQuery<TResult> { }

public interface ICommandHandler<in TCommand>
    where TCommand : ICommand
{
    Task HandleAsync(TCommand command, CancellationToken cancellationToken = default);
}

public interface ICommandHandler<in TCommand, TResult>
    where TCommand : ICommand<TResult>
{
    Task<TResult> HandleAsync(TCommand command, CancellationToken cancellationToken = default);
}

public interface IQueryHandler<in TQuery, TResult>
    where TQuery : IQuery<TResult>
{
    Task<TResult> HandleAsync(TQuery query, CancellationToken cancellationToken = default);
}

/// <summary>Pipeline behavior — wraps handler invocation. Order is established at registration.</summary>
public interface IPipelineBehavior<in TRequest, TResponse>
{
    Task<TResponse> HandleAsync(
        TRequest request,
        Func<CancellationToken, Task<TResponse>> next,
        CancellationToken cancellationToken);
}

/// <summary>
/// Dispatch facade — endpoints inject this and call SendAsync(command) / QueryAsync(query).
/// Wraps handler resolution + pipeline behavior chain.
/// </summary>
public interface IDispatcher
{
    Task SendAsync<TCommand>(TCommand command, CancellationToken cancellationToken = default)
        where TCommand : ICommand;

    Task<TResult> SendAsync<TCommand, TResult>(TCommand command, CancellationToken cancellationToken = default)
        where TCommand : ICommand<TResult>;

    Task<TResult> QueryAsync<TQuery, TResult>(TQuery query, CancellationToken cancellationToken = default)
        where TQuery : IQuery<TResult>;
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 6 — BEHAVIOR MARKERS
// ─────────────────────────
// WHAT  : Opt-in interfaces a command/query implements to activate a pipeline behavior.
// WHY   : Behavior application is explicit and per-command — no hidden globals.
// WHERE : src/Core/Enterprise.Platform.Application/Abstractions/Behaviors/
//
// PIPELINE ORDER (established by Application bootstrap registration):
//   Logging → Validation → Audit → CacheInvalidation → Transaction → Idempotency →
//   (Caching for queries)

/// <summary>Opt-in audit-trail capture (AuditBehavior → IAuditWriter).</summary>
public interface IRequiresAudit
{
    string AuditAction { get; }                 // "CreateUser", "AssignRole" — short verb
    string? AuditSubject => null;               // Target id (e.g. user id) for query filtering
}

/// <summary>Opt-in caching for queries.</summary>
public interface ICacheable
{
    string CacheKey { get; }                    // Deterministic — same inputs ⇒ same key
    TimeSpan? Ttl => null;                       // null = use region or default TTL
    string? CacheRegion => null;                 // Look up TTL from CacheSettings.Regions
}

/// <summary>Opt-in cache region invalidation on a single key.</summary>
public interface ICacheInvalidating
{
    IEnumerable<string> CacheKeysToInvalidate();
}

/// <summary>Opt-in cache region invalidation on a whole region (wildcard wipe).</summary>
public interface ICacheRegionInvalidating
{
    IEnumerable<string> CacheRegionsToInvalidate();
}

/// <summary>Opt-in idempotency check (IdempotencyBehavior → IIdempotencyStore).</summary>
public interface IIdempotent
{
    string IdempotencyKey { get; }                                      // From X-Idempotency-Key header
    TimeSpan IdempotencyWindow => TimeSpan.FromHours(24);
}

/// <summary>
/// Opt-in explicit transaction (TransactionBehavior).
/// Single-SaveChanges commands DO NOT need this — EF's implicit per-SaveChanges
/// transaction is sufficient. Use only for multi-repository operations.
/// </summary>
public interface ITransactional { }

/// <summary>Opt-in dual-approval requirement (DualApprovalBehavior — pending Phase 4).</summary>
public interface IRequiresDualApproval
{
    string ApprovalReason { get; }
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 7 — SETTINGS (server-only, IOptions-bound)
// ─────────────────────────
// WHAT  : POCOs bound from configuration sections via IOptions<T>.
// WHY   : Strongly typed config access; one source of validation per area.
// WHERE : src/Contracts/Enterprise.Platform.Contracts/Settings/
// CONVENTION : Every settings class declares `public const string SectionName = "..."`
//              for the section binding helper.

public sealed class AppSettings
{
    public const string SectionName = "App";
    public string Name { get; set; } = "Enterprise.Platform";
    public string Environment { get; set; } = "Development";
    public string Version { get; set; } = "0.0.0";
    public string Description { get; set; } = string.Empty;
    public bool DeveloperMode { get; set; }                            // NEVER true in Production
}

public sealed class JwtSettings
{
    public const string SectionName = "Jwt";
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string SigningKey { get; set; } = string.Empty;             // From Key Vault — never log
    public TimeSpan AccessTokenLifetime { get; set; } = TimeSpan.FromMinutes(15);
    public TimeSpan RefreshTokenLifetime { get; set; } = TimeSpan.FromDays(14);
    public TimeSpan ClockSkew { get; set; } = TimeSpan.FromSeconds(30);
    public bool RotateRefreshTokens { get; set; } = true;
}

public sealed class CorsSettings
{
    public const string SectionName = "Cors";
    public IReadOnlyList<string> AllowedOrigins { get; set; } = [];
    public IReadOnlyList<string> AllowedMethods { get; set; } =
        ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
    public IReadOnlyList<string> AllowedHeaders { get; set; } =
        ["Content-Type", "Authorization", "X-Correlation-ID", "X-Tenant-ID", "X-Idempotency-Key", "X-API-Version"];
    public IReadOnlyList<string> ExposedHeaders { get; set; } = ["X-Correlation-ID"];
    public bool AllowCredentials { get; set; } = true;                 // BFF cookie-session needs this
    public TimeSpan PreflightMaxAge { get; set; } = TimeSpan.FromMinutes(10);
}

public sealed class DatabaseSettings
{
    public const string SectionName = "DatabaseSettings";
    public string DefaultConnection { get; set; } = string.Empty;     // Logical name into Connections
    public Dictionary<string, DatabaseConnectionSettings> Connections { get; set; } = new();
}

public sealed class DatabaseConnectionSettings
{
    public string ConnectionStringName { get; set; } = string.Empty; // Indirection — cs read via GetConnectionString
    public DatabaseProvider Provider { get; set; } = DatabaseProvider.SqlServer;
    public int CommandTimeoutSeconds { get; set; }                   // 0 = no timeout
    public bool IsReadReplica { get; set; }                           // Writes to replica must throw
    public bool EnableSensitiveDataLogging { get; set; }              // NEVER true in Production
    public bool EnableDetailedErrors { get; set; }
}

public enum DatabaseProvider
{
    SqlServer = 0,
    PostgreSql = 1,
    InMemory = 99,                                                    // Tests only
}

public sealed class CacheSettings
{
    public const string SectionName = "Cache";
    public CacheProvider Provider { get; set; } = CacheProvider.InMemory;
    public string? RedisConnectionString { get; set; }                // Bound only when Provider=Redis
    public string KeyPrefix { get; set; } = "ep";                     // Multi-service collision guard
    public TimeSpan DefaultTtl { get; set; } = TimeSpan.FromMinutes(5);
    public Dictionary<string, TimeSpan> Regions { get; set; } = new(); // Per-region TTL overrides
}

public enum CacheProvider
{
    InMemory = 0,                                                     // Single-instance dev only
    Redis = 1,                                                        // Production default
}

public sealed class ObservabilitySettings
{
    public const string SectionName = "Observability";
    public string ServiceName { get; set; } = "enterprise-platform";  // OTel resource service.name
    public string ServiceVersion { get; set; } = "0.0.0";
    public string OtelEndpoint { get; set; } = string.Empty;          // Empty disables exporter
    public double SamplingRatio { get; set; } = 1.0;                  // Production: 0.1–0.2
    public bool EnableDatabaseInstrumentation { get; set; }            // Expensive — off by default
    public bool EnableHttpInstrumentation { get; set; } = true;
    public string? SeqEndpoint { get; set; }                           // Adds Seq sink when set
}

// (Other settings classes follow the same pattern — see live source files for full list:)
//   AzureSettings, EntraIdSettings, EntraIdB2CSettings, RateLimitSettings.

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 8 — CHROME DTOs (wire shape for /api/auth/session.chrome)
// ─────────────────────────
// WHAT  : Hand-mirrored to nav.models.ts — every property name + casing must
//         round-trip. A contract test in Architecture.Tests fails CI on drift.
// WHY   : Server-built navbar/footer config sent to the SPA at session-hydrate.
// WHERE : src/Contracts/Enterprise.Platform.Contracts/DTOs/Chrome/ChromeDtos.cs
//
// SHAPE NOTES (replicated from the live file):
//   • RoutePath simplifies to string-only on the wire (TS allows string |
//     readonly (string|number)[] | UrlTree). Static configs use string-form.
//   • UserMenuItem union (link | divider | action) wires as a flat
//     UserMenuItemDto with `Kind` discriminator + per-variant nullable fields.
//   • Badge value normalised to string ("99" not 99).

public sealed record ChromeConfigDto(NavbarConfigDto Navbar, FooterConfigDto Footer);

public sealed record NavPermissionDto(
    string? RequiredPolicy,
    string? FeatureFlag,
    IReadOnlyList<string>? Roles);

public sealed record NavBadgeDto(
    string Value,
    string Variant,                                  // "info" | "success" | "warning" | "danger" | "secondary" — see F1
    bool? Pulse);

public sealed record LanguageOptionDto(string Code, string Label, string? FlagEmoji);
public sealed record TenantOptionDto(string Id, string DisplayName, string? Domain, string? EnvBadge); // Stub — see F4

// Nav menu items
public sealed record NavMenuLeafDto(
    string Id, string Label, string? Icon,
    string? RoutePath, string? ExternalUrl,
    NavBadgeDto? Badge, NavPermissionDto? Permission,
    string? AnalyticsTag, bool? Disabled,
    string? Tooltip, string? Description);

public sealed record NavMenuSectionDto(
    string Heading, string? Subheading,
    IReadOnlyList<NavMenuLeafDto> Leaves);

public sealed record NavMenuItemDto(
    string Id, string Label, string? Icon,
    string? RoutePath, string? ExternalUrl,
    NavBadgeDto? Badge, NavPermissionDto? Permission,
    IReadOnlyList<NavMenuSectionDto>? Children,      // present ⇒ mega panel
    string? AnalyticsTag, bool? Disabled, string? Tooltip);

public sealed record NavMenuConfigDto(
    string Variant,                                   // "flat" | "mega" | "icon" | "tabs" | "sidebar"
    IReadOnlyList<NavMenuItemDto> Items,
    string ActiveMatchStrategy,                       // "exact" | "prefix" | "prefix-with-redirect"
    int? CollapseBreakpoint);

// Left zone
public sealed record NavLogoConfigDto(
    string? ImageSrc, string Alt, string? BrandName,
    string? SubLabel, string HomeRoute, string? EnvBadge);

public sealed record NavTenantSwitcherConfigDto(    // Always Enabled=false today (see F4)
    bool Enabled,
    TenantOptionDto CurrentTenant,
    IReadOnlyList<TenantOptionDto> AvailableTenants,
    NavPermissionDto? Permission);

public sealed record NavLeftZoneConfigDto(
    NavLogoConfigDto Logo,
    NavTenantSwitcherConfigDto? TenantSwitcher);

public sealed record NavCenterZoneConfigDto(NavMenuConfigDto Menu);

// Right zone widgets — every one has Enabled + optional Permission
public sealed record NavClockConfigDto(bool Enabled, NavPermissionDto? Permission, string? Timezone, string Format, bool? ShowTimezone);

public sealed record MarketDescriptorDto(string Symbol, string Label, MarketTradingHoursDto? TradingHours);
public sealed record MarketTradingHoursDto(string Open, string Close);
public sealed record NavMarketStatusConfigDto(bool Enabled, NavPermissionDto? Permission, IReadOnlyList<MarketDescriptorDto>? Markets);

public sealed record NavShiftStatusConfigDto(bool Enabled, NavPermissionDto? Permission, string? Label);
public sealed record NavGlobalSearchConfigDto(bool Enabled, NavPermissionDto? Permission, string? Placeholder, string? SearchRoute, bool? CommandPaletteMode);
public sealed record NavAiAssistantConfigDto(bool Enabled, NavPermissionDto? Permission, string? Label, string? Icon, string ActionKey);

public sealed record QuickActionDto(string Id, string Label, string? Icon, string ActionKey, NavPermissionDto? Permission, NavBadgeDto? Badge, string? Shortcut);
public sealed record NavQuickActionsConfigDto(bool Enabled, NavPermissionDto? Permission, string? Label, string? Icon, IReadOnlyList<QuickActionDto> Actions);

public sealed record NavBellWidgetConfigDto(bool Enabled, NavPermissionDto? Permission, int? MaxBadgeCount, string? ViewAllRoute);
public sealed record NavHelpConfigDto(bool Enabled, NavPermissionDto? Permission, string? DocsUrl, string? Label, string? Icon);
public sealed record NavThemeToggleConfigDto(bool Enabled, NavPermissionDto? Permission, bool? IncludeSystem);
public sealed record NavLanguageSwitcherConfigDto(bool Enabled, NavPermissionDto? Permission, IReadOnlyList<LanguageOptionDto> Languages);

/// <summary>Flattened TS UserMenuItem union — discriminate on Kind.</summary>
public sealed record UserMenuItemDto(
    string Kind,                                      // "link" | "divider" | "action"
    string Id, string? Label, string? Icon,
    NavPermissionDto? Permission, bool? Disabled,
    string? RoutePath, string? ExternalUrl,            // link variant
    string? ActionKey, bool? IsLogout);                // action variant

public sealed record NavUserMenuConfigDto(
    bool Enabled, bool ShowNameInHeader, bool ShowRoleInHeader,
    IReadOnlyList<UserMenuItemDto> MenuItems);

public sealed record NavRightZoneConfigDto(
    NavClockConfigDto? Clock,
    NavMarketStatusConfigDto? MarketStatus,
    NavShiftStatusConfigDto? ShiftStatus,
    NavGlobalSearchConfigDto? GlobalSearch,
    NavAiAssistantConfigDto? AiAssistant,
    NavQuickActionsConfigDto? QuickActions,
    NavBellWidgetConfigDto? Messages,
    NavBellWidgetConfigDto? Notifications,
    NavHelpConfigDto? Help,
    NavThemeToggleConfigDto? ThemeToggle,
    NavLanguageSwitcherConfigDto? LanguageSwitcher,
    NavUserMenuConfigDto UserMenu);

public sealed record NavbarConfigDto(
    NavLeftZoneConfigDto LeftZone,
    NavCenterZoneConfigDto CenterZone,
    NavRightZoneConfigDto RightZone,
    bool? Sticky, bool? GlassMorphism, int? HeightPx);

// Footer — composable section blocks. Mirrors `FooterConfig` in
// shared/layout/models/nav.models.ts. The architecture contract test
// diffs property names between this file and the TS interface; renaming
// either side breaks CI.
public sealed record FooterLinkDto(string Label, string? RoutePath, string? ExternalUrl, string? Icon, NavBadgeDto? Badge);
public sealed record FooterLinkColumnDto(string? Heading, string? Tone, IReadOnlyList<FooterLinkDto> Links);   // Tone: "default" | "highlight"
public sealed record FooterNewsletterConfigDto(bool Enabled, string? Heading, string? Placeholder, string? SubmitLabel, string? ActionKey, string? ThanksMessage);
public sealed record FooterCookieConsentLabelsDto(string? Body, string? AcceptLabel, string? RejectLabel, string? PolicyUrl, string? PolicyLabel);
public sealed record FooterComplianceConfigDto(IReadOnlyList<string>? Badges, string? Disclaimer, bool? CookieConsent, FooterCookieConsentLabelsDto? CookieConsentLabels);
public sealed record SocialLinkDto(string Platform, string Url, string? AriaLabel);                              // Platform: 'twitter'|'linkedin'|'github'|'youtube'|'facebook'|'instagram'|'mastodon'|'discord'|'rss'|'tiktok'|'pinterest'
public sealed record FooterSocialConfigDto(string? Heading, IReadOnlyList<SocialLinkDto> Links);
public sealed record FooterBrandConfigDto(string? ImageSrc, string Alt, string? BrandName, string? Tagline, IReadOnlyList<string>? AddressLines, string? HomeRoute);
public sealed record FooterAccreditationConfigDto(string ImageSrc, string ImageAlt, string? Caption, int? ImageWidthPx, string? ExternalUrl);
public sealed record FooterUtilityBarConfigDto(IReadOnlyList<FooterLinkDto> Links);
public sealed record FooterCopyrightConfigDto(string Owner, int? Year, string? Text);
public sealed record FooterMetaConfigDto(string? AppVersion, string? BuildId, string? StatusPageUrl, string? StatusLabel, NavLanguageSwitcherConfigDto? LanguageSwitcher);
public sealed record FooterFlagConfigDto(string ImageSrc, string Alt, int? HeightPx);

public sealed record FooterConfigDto(
    string Variant,                                   // "full" | "minimal" | "app"
    FooterBrandConfigDto? Brand,
    FooterSocialConfigDto? Social,
    IReadOnlyList<FooterLinkColumnDto>? Columns,
    FooterNewsletterConfigDto? Newsletter,
    FooterAccreditationConfigDto? Accreditation,
    FooterComplianceConfigDto? Compliance,
    FooterUtilityBarConfigDto? UtilityBar,
    FooterCopyrightConfigDto? Copyright,                                            // SPA falls back to "© {currentYear}" when absent
    FooterMetaConfigDto? Meta,
    FooterFlagConfigDto? Flag);

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 9 — SESSION + AUTH
// ─────────────────────────
// WHAT  : Server projection of the authenticated principal + chrome config —
//         what the SPA receives from GET /api/auth/session.
// WHY   : Single round-trip hydrates the SPA's identity + menu state.
// WHERE : src/Contracts/Enterprise.Platform.Contracts/DTOs/Auth/ (today) +
//         src/UI/Enterprise.Platform.Web.UI/Services/Chrome/

/// <summary>
/// Session payload returned to the SPA after successful Entra/cookie auth.
/// Per FLAGS §F8 the SPA's CurrentUser is a NARROW projection of this
/// (just displayName + email). Auth state lives in AuthStore separately.
/// </summary>
public sealed record SessionInfoDto(
    bool IsAuthenticated,
    Guid? UserId,
    string? Email,
    string? DisplayName,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,                // dot-form perm strings
    bool Bypass,
    int? PermissionsTtlSeconds,
    ChromeConfigDto? Chrome);                          // null on anonymous

/// <summary>
/// Effective-permissions DTO — proposed shape (see FLAGS §F7; not yet present
/// as a contract record — endpoint constructs JSON inline today).
/// </summary>
public sealed record EffectivePermissionsDto(
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,
    bool Bypass,
    int? TtlSeconds);

/// <summary>
/// Ambient authenticated-caller info. Populated from HttpContext by
/// CurrentUserService and injected into handlers/interceptors/audit writers.
/// All properties safe to read on anonymous requests.
/// </summary>
public interface ICurrentUserService
{
    Guid? UserId { get; }                              // null on anonymous
    string? Email { get; }
    bool IsAuthenticated { get; }
    bool HasPermission(string permission);              // ep:permission claim exact-match
    bool IsInRole(string role);
    // ▲ TenantId removed 2026-04-25 — see F4
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 10 — CONSTANTS
// ─────────────────────────
// WHAT  : Stable string keys used across tiers (headers, claims, sizes).
// WHY   : Magic strings in code break on rename; constants surface drift in PR.
// WHERE : src/Contracts/Enterprise.Platform.Shared/Constants/

/// <summary>
/// Stable HTTP header names shared by Api / BFF / UI tiers.
/// Per FLAGS §F6 — no TS mirror exists today; SPA uses raw strings.
/// </summary>
public static class HttpHeaderNames
{
    public const string CorrelationId  = "X-Correlation-ID";       // End-to-end trace id
    public const string IdempotencyKey = "X-Idempotency-Key";      // X- prefix REQUIRED — bare 'Idempotency-Key' 400s
    public const string ApiVersion     = "X-API-Version";           // Asp.Versioning input
    public const string RequestId      = "X-Request-ID";
}

/// <summary>Custom JWT/ClaimsPrincipal claim type strings issued by Enterprise.Platform.</summary>
public static class ClaimTypes
{
    public const string UserId     = "ep:user_id";                 // GUID, string-serialized
    public const string Permission = "ep:permission";              // Fine-grained, e.g. "users.read"
    public const string Role       = "ep:role";                    // Coarse label
    public const string SessionId  = "ep:session_id";              // Refresh-token rotation key
}

/// <summary>Application-wide numeric constants. One source of truth for column lengths, paging bounds, timeouts.</summary>
public static class AppConstants
{
    public static class StringLengths
    {
        public const int Name        = 100;        // NVARCHAR(100)
        public const int LongName    = 256;
        public const int Email       = 320;        // RFC 5321 practical max
        public const int Phone       = 32;          // E.164 + leading +
        public const int Url         = 2048;
        public const int Description = 1000;
        public const int Narrative   = 4000;
    }

    public static class Paging
    {
        public const int DefaultPageSize   = 25;
        public const int MaxPageSize       = 200;   // Cap per request — DB+network protection
        public const int DefaultPageNumber = 1;
    }

    public static class Timeouts
    {
        public const int DatabaseCommandSeconds = 30;
        public const int HttpClientSeconds       = 30;
        public const int CacheOperationSeconds   = 5;
    }

    public static class Auth
    {
        public const int AccessTokenMinutes = 15;
        public const int RefreshTokenDays   = 14;
    }
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 11 — PERMISSIONS (USERS — CANONICAL TEMPLATE)
// ─────────────────────────
// WHAT  : Permission constants for one feature (User aggregate).
// WHY   : Endpoints decorate themselves with RequireAuthorization(perm:...);
//         RbacPolicyProvider synthesises a PermissionRequirement on demand.
// WHERE : src/Core/Enterprise.Platform.Application/Features/Users/UserPermissions.cs
//
// CONVENTION
//   • <aggregate>.<action>, lower-case, dot-separated.
//   • Compared CASE-INSENSITIVELY by RbacPolicyProvider.
//   • Wire format identical to SPA's USER_PERMISSIONS dictionary (F8).
//
// ACTION VOCABULARY
//   read       — list + detail (all GET endpoints)
//   create     — provisioning
//   write      — rename, change email (mutate existing fields)
//   activate   — restore sign-in
//   deactivate — suspend sign-in
//
// activate/deactivate are SPLIT from write because HIPAA/SOX treat
// activation-state changes as a distinct privileged action.

public static class UserPermissions
{
    public const string Read       = "users.read";
    public const string Create     = "users.create";
    public const string Write      = "users.write";
    public const string Activate   = "users.activate";
    public const string Deactivate = "users.deactivate";
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 12 — FEATURE COMMANDS / QUERIES (USERS — CANONICAL TEMPLATE)
// ─────────────────────────
// WHAT  : Concrete CQRS shapes the User feature emits. Use these as a
//         template when scaffolding a new aggregate (see DB-First-Workflow).
// WHY   : Demonstrates the marker-interface composition pattern:
//         IRequiresAudit + ICacheRegionInvalidating + IIdempotent on creates;
//         ICacheable on list queries.
// WHERE : src/Core/Enterprise.Platform.Application/Features/Users/

// ─── UserDto — DtoGen-emitted (schema-as-source-of-truth) ────────────────────────
//   SOURCE : src/Contracts/Enterprise.Platform.Contracts/DTOs/App/UserDto.cs
//            (auto-generated; edit the entity declaration, not the DTO)
//   DRIFT  : RowVersion deliberately omitted — see FLAGS §F5.
public sealed record UserDto(
    string Email,
    string FirstName,
    string LastName,
    Guid? ExternalIdentityId,
    bool IsActive,
    DateTimeOffset? LastLoginAt,
    bool IsDeleted,
    DateTimeOffset? DeletedAt,
    string? DeletedBy,
    string CreatedBy,
    DateTimeOffset CreatedAt,
    string? ModifiedBy,
    DateTimeOffset? ModifiedAt,
    Guid Id);

// ─── Commands ───────────────────────────────────────────────────────────────────
//   PIPELINE : Logging → Validation → Audit → CacheInvalidation → Idempotency
//   IDEMPOTENCY-KEY : Required header X-Idempotency-Key (UUID v4 by convention)

public sealed record CreateUserCommand(
    string Email,
    string FirstName,
    string LastName,
    Guid? ExternalIdentityId)
    : ICommand<Result<UserDto>>, IRequiresAudit, ICacheRegionInvalidating, IIdempotent
{
    public string AuditAction => "CreateUser";
    public string? AuditSubject => Email.ToLowerInvariant();
    public IEnumerable<string> CacheRegionsToInvalidate() { yield return "users"; }
    public string IdempotencyKey { get; init; } = string.Empty;
}

public sealed record RenameUserCommand(Guid UserId, string FirstName, string LastName)
    : ICommand<Result>, IRequiresAudit
{
    public string AuditAction => "RenameUser";
    public string? AuditSubject => UserId.ToString();
}

public sealed record ChangeUserEmailCommand(Guid UserId, string NewEmail)
    : ICommand<Result>, IRequiresAudit, ICacheRegionInvalidating
{
    public string AuditAction => "ChangeUserEmail";
    public string? AuditSubject => UserId.ToString();
    public IEnumerable<string> CacheRegionsToInvalidate() { yield return "users"; }
}

public sealed record ActivateUserCommand(Guid UserId) : ICommand<Result>, IRequiresAudit
{
    public string AuditAction => "ActivateUser";
    public string? AuditSubject => UserId.ToString();
}

public sealed record DeactivateUserCommand(Guid UserId, string Reason) : ICommand<Result>, IRequiresAudit
{
    public string AuditAction => "DeactivateUser";
    public string? AuditSubject => UserId.ToString();
}

// ─── Queries ────────────────────────────────────────────────────────────────────
//   PIPELINE : Logging → Validation → Caching (when ICacheable)

public sealed record GetUserByIdQuery(Guid UserId) : IQuery<Result<UserDto>>, ICacheable
{
    public string CacheKey => $"users:byid:{UserId:N}";
    public TimeSpan? Ttl => TimeSpan.FromMinutes(2);
    public string? CacheRegion => "users";
}

public sealed record ListUsersQuery(
    int Page = 1,
    int PageSize = 25,
    string? Search = null,
    bool? ActiveOnly = null) : IQuery<PagedResult<UserDto>>, ICacheable
{
    // Cache key encodes EVERY input — distinct filters never collide.
    public string CacheKey => $"users:list:p={Page}:s={PageSize}:q={Search ?? "*"}:active={ActiveOnly?.ToString() ?? "*"}";
    public TimeSpan? Ttl => TimeSpan.FromMinutes(2);
    public string? CacheRegion => "users";
}

// ═════════════════════════════════════════════════════════════════════════════════
//
//                                ─── END OF FILE ───
//
// REVIEW CADENCE  Quarterly. When a section's source-of-truth file changes shape,
//                 update this consolidated view in the same PR.
// CONTRACT TESTS  Architecture.Tests verify the §8 chrome DTOs against
//                 nav.models.ts. Other sections rely on PR review until
//                 generated bridges land.
// CHANGELOG       Each FLAG closure should add a "RESOLVED <date>" line above
//                 the flag entry rather than deleting it, so the audit trail
//                 stays visible to future readers (e.g. F8 below).
//
//   F8 RESOLVED 2026-04-29 (memory: reference_user_module_e2e_done) — kept here
//      as a worked example of the resolution-trail format.
// ═════════════════════════════════════════════════════════════════════════════════
