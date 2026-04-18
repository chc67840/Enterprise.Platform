# 05 — CQRS & Data Access Patterns

> Read/Write separation, EF Core best practices, UnitOfWork, Repository, Performance  
> The heart of the data architecture redesign

---

## Table of Contents

1. [CQRS Architecture](#1-cqrs-architecture)
2. [Read/Write DbContext Separation](#2-readwrite-dbcontext-separation)
3. [Repository Pattern (Redesigned)](#3-repository-pattern-redesigned)
4. [Unit of Work (Simplified)](#4-unit-of-work-simplified)
5. [EF Core Best Practices](#5-ef-core-best-practices)
6. [Raw SQL Query Safety](#6-raw-sql-query-safety)
7. [Transaction Management](#7-transaction-management)
8. [Performance Patterns](#8-performance-patterns)

---

## 1. CQRS Architecture

### 1.1 Why CQRS for RIMS

| Problem | CQRS Solution |
|---|---|
| `FetchAllReferral()` is 200+ lines of SQL building + N+1 queries | Read handler uses read-optimized context + batch loading |
| `SaveReferralSection()` mixes validation + orchestration + persistence | Command handler focuses only on write path |
| Same assembler class does both reads and writes (800+ lines) | Separate handlers, each <100 lines |
| `.GetAwaiter().GetResult()` sync-over-async in read paths | Read handlers are fully async with batch data loading |
| `AsNoTracking()` bug affects all queries | Read context has `AsNoTracking()` globally — impossible to forget |

### 1.2 CQRS Abstractions

```csharp
// Command — mutates state
public interface ICommand<TResult> { }
public interface ICommandHandler<TCommand, TResult> 
    where TCommand : ICommand<TResult>
{
    Task<TResult> Handle(TCommand command, CancellationToken ct);
}

// Query — reads state (no side effects)
public interface IQuery<TResult> { }
public interface IQueryHandler<TQuery, TResult> 
    where TQuery : IQuery<TResult>
{
    Task<TResult> Handle(TQuery query, CancellationToken ct);
}

// Marker interfaces for pipeline behaviors
public interface ITransactional { }         // Wraps in transaction
public interface IRequiresAudit { }         // Creates audit entry
public interface IRequiresDualApproval { }  // Financial dual-approval
```

### 1.3 Pipeline Behaviors (Ordered)

```csharp
// Pipeline order for COMMANDS:
// 1. LoggingBehavior       ? Log entry + exit + elapsed time
// 2. ValidationBehavior    ? FluentValidation (throws on failure)
// 3. PHIAuditBehavior      ? Log PHI access (HIPAA)
// 4. TransactionBehavior   ? Begin/Commit/Rollback transaction
// 5. Handler               ? Actual business logic

// Pipeline order for QUERIES:
// 1. LoggingBehavior       ? Log entry + exit + elapsed time  
// 2. ValidationBehavior    ? Validate query parameters
// 3. CachingBehavior       ? Check cache before handler (optional)
// 4. Handler               ? Actual query logic
// 5. PHIMaskingBehavior    ? Mask PHI fields based on user role

// Registration
services.AddScoped(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
services.AddScoped(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
services.AddScoped(typeof(IPipelineBehavior<,>), typeof(TransactionBehavior<,>));
```

### 1.4 Dispatcher (Lightweight Mediator)

```csharp
// No need for full MediatR — lightweight dispatcher
public interface IDispatcher
{
    Task<TResult> Send<TResult>(ICommand<TResult> command, CancellationToken ct = default);
    Task<TResult> Query<TResult>(IQuery<TResult> query, CancellationToken ct = default);
}

public class Dispatcher(IServiceProvider services) : IDispatcher
{
    public async Task<TResult> Send<TResult>(
        ICommand<TResult> command, CancellationToken ct = default)
    {
        var handlerType = typeof(ICommandHandler<,>)
            .MakeGenericType(command.GetType(), typeof(TResult));
        dynamic handler = services.GetRequiredService(handlerType);
        return await handler.Handle((dynamic)command, ct);
    }

    public async Task<TResult> Query<TResult>(
        IQuery<TResult> query, CancellationToken ct = default)
    {
        var handlerType = typeof(IQueryHandler<,>)
            .MakeGenericType(query.GetType(), typeof(TResult));
        dynamic handler = services.GetRequiredService(handlerType);
        return await handler.Handle((dynamic)query, ct);
    }
}

// Usage in API endpoint
public static async Task<IResult> FetchAllReferral(
    LazyLoadCdto filters,
    [FromServices] IDispatcher dispatcher,
    CancellationToken ct)
{
    var result = await dispatcher.Query(new FetchAllReferralsQuery(filters), ct);
    return Results.Ok(Response.Success(result));
}
```

---

## 2. Read/Write DbContext Separation

### 2.1 Write Context (Change Tracking + Auditing)

```csharp
public class RimsWriteDbContext : DbContext, IRimsWriteDbContext
{
    public long? UserSessionId { get; set; }
    public long? UserAccountId { get; set; }

    public RimsWriteDbContext(DbContextOptions<RimsWriteDbContext> options)
        : base(options) { }

    // All DbSets for write operations
    public DbSet<Application> Applications { get; set; }
    public DbSet<ApplicationMember> ApplicationMembers { get; set; }
    // ... all entities

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        // EXISTING: Audit stamp logic (CreatedBy, ModifiedBy, etc.)
        ApplyAuditStamps();

        // NEW: PHI audit trail
        await LogPHIChanges(ct);

        return await base.SaveChangesAsync(ct);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // PHI encryption converters
        ApplyPHIEncryption(modelBuilder);

        // Soft delete global filter
        modelBuilder.Entity<Application>()
            .HasQueryFilter(a => !a.IsDeleted);

        // Concurrency tokens
        modelBuilder.Entity<Application>()
            .Property(a => a.RowVersion)
            .IsRowVersion();
    }

    protected override void OnConfiguring(DbContextOptionsBuilder options)
    {
        // Write context uses change tracking (default)
        // Lazy loading DISABLED — explicit includes required
        options.UseSqlServer(_connectionString);

        // Add PHI audit interceptor
        options.AddInterceptors(new PHIAuditInterceptor());
    }
}
```

### 2.2 Read Context (No Tracking + Optimized)

```csharp
public class RimsReadDbContext : DbContext, IRimsReadDbContext
{
    public RimsReadDbContext(DbContextOptions<RimsReadDbContext> options)
        : base(options) { }

    // Same DbSets but read-only
    public DbSet<Application> Applications { get; set; }
    public DbSet<ApplicationMember> ApplicationMembers { get; set; }
    // ... all entities

    protected override void OnConfiguring(DbContextOptionsBuilder options)
    {
        options.UseSqlServer(_connectionString)
            .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking); // Global!

        // NO lazy loading — prevents accidental N+1 queries
        // NO PHI audit interceptor — reads are logged via query handlers
    }

    // Read context does NOT override SaveChangesAsync — it's read-only
    // Calling SaveChanges() throws InvalidOperationException
    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        throw new InvalidOperationException(
            "Read context is read-only. Use RimsWriteDbContext for writes.");
    }
}
```

### 2.3 Registration

```csharp
// Program.cs / ServiceExtensions.cs
public static IServiceCollection AddDbContexts(this IServiceCollection services)
{
    // Write context — scoped (one per request)
    services.AddDbContext<RimsWriteDbContext>(options =>
        options.UseSqlServer("Name=AppSettings:DbConnection"));

    // Read context — scoped, separate instance
    services.AddDbContext<RimsReadDbContext>(options =>
        options.UseSqlServer("Name=AppSettings:DbReadConnection") // Can point to read replica
            .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));

    // Interface registration
    services.AddScoped<IRimsWriteDbContext>(sp => sp.GetRequiredService<RimsWriteDbContext>());
    services.AddScoped<IRimsReadDbContext>(sp => sp.GetRequiredService<RimsReadDbContext>());

    return services;
}
```

### 2.4 When to Use Which Context

| Operation | Context | Why |
|---|---|---|
| List pages (FetchAllReferrals, FetchAllCases) | Read | No tracking needed, performance |
| Detail views (GetReferralSection) | Read | No tracking needed |
| Save operations (SaveReferralSection) | Write | Change tracking + audit stamps |
| Lock/Unlock operations | Write | State mutation |
| Report generation (read data) | Read | Large datasets, no tracking |
| Report save (persist results) | Write | State mutation |
| CHIP/SSO lookups | Neither | External service calls |
| Reference value lookups | Read | Cacheable reads |

---

## 3. Repository Pattern (Redesigned)

### 3.1 Fixed Generic Repository

```csharp
public class GenericRepository<TEntity> : IGenericRepository<TEntity> 
    where TEntity : class
{
    private readonly DbContext _context;
    private readonly DbSet<TEntity> _dbSet;

    public GenericRepository(DbContext context)
    {
        _context = context;
        _dbSet = context.Set<TEntity>();
    }

    public async Task<TEntity?> GetByIdAsync(
        Expression<Func<TEntity, bool>> predicate,
        CancellationToken ct = default,
        params Expression<Func<TEntity, object>>[] includes)
    {
        IQueryable<TEntity> query = _dbSet;
        foreach (var include in includes)
            query = query.Include(include);

        return await query.FirstOrDefaultAsync(predicate, ct);
    }

    public IQueryable<TEntity> Query()
    {
        // No AsNoTracking() call here — the context determines tracking behavior
        // Write context: tracked. Read context: untracked (globally).
        return _dbSet.AsQueryable();
    }

    public async Task<TEntity> AddAsync(TEntity entity, CancellationToken ct = default)
    {
        await _dbSet.AddAsync(entity, ct);
        return entity;
    }

    public Task UpdateAsync(TEntity entity, CancellationToken ct = default)
    {
        _dbSet.Update(entity);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(TEntity entity, CancellationToken ct = default)
    {
        _dbSet.Remove(entity);
        return Task.CompletedTask;
    }

    public async Task AddRangeAsync(
        IEnumerable<TEntity> entities, CancellationToken ct = default)
    {
        await _dbSet.AddRangeAsync(entities, ct);
    }
}
```

**Key changes from current code**:
- Removed `try { } catch { throw; }` noise
- Removed `await Task.CompletedTask` anti-pattern
- Removed `asNoTracking` parameter — context determines this
- Removed `commitChanges` parameter — UnitOfWork controls commit
- Removed `bool commitChanges` — single responsibility

---

## 4. Unit of Work (Simplified)

### 4.1 Current Problem

The current `UnitOfWork` constructor takes **60+ repository parameters**. Every new entity requires modifying the constructor, adding a property, and assigning it.

### 4.2 Redesigned UnitOfWork

```csharp
public interface IUnitOfWork : IDisposable
{
    IGenericRepository<T> Repository<T>() where T : class;
    Task BeginTransactionAsync(CancellationToken ct = default);
    Task<int> CommitAsync(CancellationToken ct = default);
    Task RollbackAsync(CancellationToken ct = default);
    long GetUserSessionId();
    long GetUserAccountId();
}

public class UnitOfWork : IUnitOfWork
{
    private readonly RimsWriteDbContext _context;
    private IDbContextTransaction? _transaction;
    private readonly ConcurrentDictionary<Type, object> _repositories = new();

    public UnitOfWork(RimsWriteDbContext context)
    {
        _context = context;
    }

    public IGenericRepository<T> Repository<T>() where T : class
    {
        return (IGenericRepository<T>)_repositories.GetOrAdd(
            typeof(T),
            _ => new GenericRepository<T>(_context));
    }

    public async Task BeginTransactionAsync(CancellationToken ct = default)
    {
        _transaction ??= await _context.Database.BeginTransactionAsync(ct);
    }

    public async Task<int> CommitAsync(CancellationToken ct = default)
    {
        try
        {
            var result = await _context.SaveChangesAsync(ct);
            if (_transaction != null)
            {
                await _transaction.CommitAsync(ct);
                await _transaction.DisposeAsync();
                _transaction = null;
            }
            return result;
        }
        catch
        {
            await RollbackAsync(ct);
            throw;
        }
    }

    public async Task RollbackAsync(CancellationToken ct = default)
    {
        if (_transaction != null)
        {
            await _transaction.RollbackAsync(ct);
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public long GetUserSessionId() => _context.UserSessionId.GetValueOrDefault();
    public long GetUserAccountId() => _context.UserAccountId.GetValueOrDefault();

    public void Dispose()
    {
        _transaction?.Dispose();
        GC.SuppressFinalize(this);
    }
}
```

**Benefits**:
- Constructor takes ONE parameter instead of 60+
- Adding new entities requires ZERO changes to UnitOfWork
- Thread-safe repository caching via `ConcurrentDictionary`
- Proper disposal pattern

### 4.3 Usage

```csharp
// Before (60+ named repositories):
unitOfWork.Applications.GetByIdAsync(...)
unitOfWork.ApplicationMembers.Query()

// After (generic):
unitOfWork.Repository<Application>().GetByIdAsync(...)
unitOfWork.Repository<ApplicationMember>().Query()
```

---

## 5. EF Core Best Practices

### 5.1 Split Queries for Complex Includes

```csharp
// PROBLEM: Cartesian explosion when including multiple collections
// Loading an Application with Members, Addresses, Contacts, Benefits
// creates MxAxCxB rows in the result set

// SOLUTION: AsSplitQuery()
var application = await readContext.Applications
    .Include(a => a.ApplicationMembers)
    .Include(a => a.ApplicationAddresses)
    .Include(a => a.ApplicationContacts)
    .Include(a => a.ApplicationBenefits)
    .AsSplitQuery()                    // Separate query per include
    .FirstOrDefaultAsync(a => a.Id == applicationId, ct);

// This generates 5 SQL queries instead of 1 with massive JOINs
// Each query is simpler and returns fewer rows
```

### 5.2 Compiled Queries

```csharp
// For frequently-executed queries (reference lookups, etc.)
public static class CompiledQueries
{
    public static readonly Func<RimsReadDbContext, int, Task<ReferenceValue?>> 
        GetReferenceValueById = EF.CompileAsyncQuery(
            (RimsReadDbContext ctx, int id) =>
                ctx.ReferenceValues.FirstOrDefault(r => r.Id == id));

    public static readonly Func<RimsReadDbContext, int, IAsyncEnumerable<ReferenceValue>> 
        GetReferenceValuesByCode = EF.CompileAsyncQuery(
            (RimsReadDbContext ctx, int codeId) =>
                ctx.ReferenceValues
                    .Where(r => r.ReferenceCodeId == codeId && r.IsActive)
                    .OrderBy(r => r.Sequence));

    public static readonly Func<RimsReadDbContext, long, Task<User?>> 
        GetUserById = EF.CompileAsyncQuery(
            (RimsReadDbContext ctx, long id) =>
                ctx.Users.FirstOrDefault(u => u.Id == id));
}

// Usage
var refValue = await CompiledQueries.GetReferenceValueById(readContext, statusId);
```

### 5.3 Projection Queries (Select Only What You Need)

```csharp
// PROBLEM: Loading full entity when you only need 3 fields
// Current: .Select(dto => dto.GetDto()) loads all columns

// SOLUTION: Project in the query
var referralSummaries = await readContext.Applications
    .Where(a => a.Status == (int)ApplicationStatus.Referral_Pending)
    .Select(a => new ReferralSummaryDto
    {
        Id = a.Id,
        ReferenceNumber = a.RefNumber,
        Status = a.Status,
        CreatedDate = a.CreatedDate,
        PrimaryName = a.ApplicationMembers
            .Where(m => m.RelationShipId == (int)Relationship.PI)
            .Select(m => m.FirstName + " " + m.LastName)
            .FirstOrDefault()
    })
    .ToListAsync(ct);
// Only queries the columns in the projection — no extra data loaded
```

### 5.4 Batch Operations (.NET 8 ExecuteUpdate/ExecuteDelete)

```csharp
// PROBLEM: Loading entity, modifying, then saving — 2 round trips
// Current: var app = await GetByIdAsync(...); app.WorkerId = null; await UpdateAsync(app);

// SOLUTION: Single-statement update
await writeContext.Applications
    .Where(a => a.Id == applicationId)
    .ExecuteUpdateAsync(s => s
        .SetProperty(a => a.WorkerId, (long?)null)
        .SetProperty(a => a.ModifiedBy, sessionId)
        .SetProperty(a => a.ModifiedDate, DateTime.Now), ct);

// Batch delete expired sessions
await writeContext.UserSessions
    .Where(s => s.ExpirationDate < DateTime.UtcNow.AddDays(-30))
    .ExecuteDeleteAsync(ct);
```

### 5.5 Concurrency Control

```csharp
// Prevent lost updates on concurrent edits
public partial class Application
{
    [Timestamp]
    public byte[] RowVersion { get; set; }
}

// In handler
try
{
    await unitOfWork.CommitAsync(ct);
}
catch (DbUpdateConcurrencyException)
{
    throw new ConcurrencyConflictException(
        "This record was modified by another user. Please refresh and try again.");
}
```

---

## 6. Raw SQL Query Safety

### 6.1 Current Vulnerability

```csharp
// VULNERABLE — user input interpolated into SQL string
appFitlerList.Add(
    $"a.{item.Key} {item.Value.MatchMode.getFilterCondition((object)item.Value.Value)}"
);
string finalQuery = string.Format(QueryConstants.QryToRefarralLazyLoading, ...);
await context.Database.SqlQueryRaw<ApplicationCdto>(finalQuery);
```

### 6.2 Safe Query Service (Redesigned)

```csharp
public class ReferralQueryService : IReferralQueryService
{
    private readonly RimsReadDbContext _readContext;

    // Allow-list of valid filter columns
    private static readonly Dictionary<string, string> AllowedFilterColumns = new()
    {
        [ReferralSearchType.ReferenceNumber] = "a.ReferenceNumber",
        [ReferralSearchType.FullName] = "CONCAT(am.FirstName, ' ', am.LastName)",
        [ReferralSearchType.CreatedDate] = "CAST(a.CreatedDate AS DATE)",
        [ReferralSearchType.DeniedDate] = "CAST(a.DeniedDate AS DATE)",
        // ... exhaustive list
    };

    public async Task<(List<ApplicationDto> Results, int TotalCount)> SearchReferrals(
        LazyLoadCdto filters, CancellationToken ct)
    {
        var parameters = new List<SqlParameter>();
        var conditions = new List<string>();
        var paramIndex = 0;

        foreach (var filter in filters.Filters)
        {
            if (filter.Value?.Value is null) continue;

            // Validate column name against allow-list
            if (!AllowedFilterColumns.TryGetValue(filter.Key, out var columnExpr))
            {
                throw new ValidationException($"Invalid filter key: {filter.Key}");
            }

            // Build parameterized condition
            switch (filter.Key)
            {
                case ReferralSearchType.ReferenceNumber:
                {
                    var paramName = $"@p{paramIndex++}";
                    conditions.Add($"{columnExpr} LIKE {paramName}");
                    parameters.Add(new SqlParameter(paramName, $"%{filter.Value.Value}%"));
                    break;
                }
                case ReferralSearchType.StatusDescription:
                {
                    // Multi-value filter — parameterize each value
                    var statusValues = DeserializeFilterValues(filter.Value.Value);
                    if (statusValues.Any())
                    {
                        var statusParams = statusValues.Select((v, i) =>
                        {
                            var name = $"@status{paramIndex++}";
                            parameters.Add(new SqlParameter(name, v));
                            return name;
                        });
                        conditions.Add($"a.Status IN ({string.Join(",", statusParams)})");
                    }
                    break;
                }
                case ReferralSearchType.CreatedDate:
                {
                    var startParam = $"@dateStart{paramIndex++}";
                    parameters.Add(new SqlParameter(startParam, filter.Value.Value));
                    conditions.Add($"{columnExpr} >= {startParam}");

                    if (filter.Value.MatchMode == FilterMatchModes.Between)
                    {
                        var endParam = $"@dateEnd{paramIndex++}";
                        parameters.Add(new SqlParameter(endParam, filters.Value));
                        conditions.Add($"{columnExpr} < {endParam}");
                    }
                    break;
                }
            }
        }

        // Pagination parameters
        var offsetParam = new SqlParameter("@offset", filters.First);
        var limitParam = new SqlParameter("@limit", filters.Rows);
        parameters.AddRange(new[] { offsetParam, limitParam });

        // Build final query with parameterized conditions
        var whereClause = conditions.Count > 0 
            ? "AND " + string.Join(" AND ", conditions) 
            : string.Empty;

        var query = $@"
            SELECT a.*, COUNT(*) OVER() AS TotalRecords
            FROM Application a
            JOIN ApplicationMember am ON am.ApplicationId = a.Id
            WHERE a.IsDeleted = 0 {whereClause}
            ORDER BY a.CreatedDate DESC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY";

        var results = await _readContext.Database
            .SqlQueryRaw<ApplicationCdto>(query, parameters.ToArray())
            .ToListAsync(ct);

        return (results.CopyListDataTo<ApplicationCdto, ApplicationDto>(), 
                results.FirstOrDefault()?.TotalRecords ?? 0);
    }
}
```

---

## 7. Transaction Management

### 7.1 Transaction Strategy

| Scenario | Strategy |
|---|---|
| Single entity save | No explicit transaction (EF auto-transaction) |
| Multi-entity save (same aggregate) | `IDbContextTransaction` via UnitOfWork |
| Cross-aggregate operations | `IDbContextTransaction` via UnitOfWork |
| Read operations | No transaction needed |
| Batch operations | Chunked transactions (100 records per commit) |

### 7.2 Transaction Pipeline Behavior

```csharp
public class TransactionBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : ITransactional
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogHandler _logger;

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken ct)
    {
        await _unitOfWork.BeginTransactionAsync(ct);

        try
        {
            var response = await next();
            await _unitOfWork.CommitAsync(ct);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Transaction rolled back for {RequestType}", 
                typeof(TRequest).Name);
            await _unitOfWork.RollbackAsync(ct);
            throw;
        }
    }
}
```

---

## 8. Performance Patterns

### 8.1 N+1 Query Prevention

```csharp
// CURRENT PROBLEM in FetchAllReferral():
// For 50 referrals ? 200+ additional queries

// SOLUTION: Batch pre-loading
public async Task<ManageReferralCdto> Handle(
    FetchAllReferralsQuery query, CancellationToken ct)
{
    // Step 1: Main query (1 SQL query)
    var (results, totalCount) = await _queryService.SearchReferrals(query.Filters, ct);
    if (results.Count == 0) return new ManageReferralCdto();

    // Step 2: Batch load ALL related data (3 SQL queries total)
    var appIds = results.Select(r => r.Id).ToList();

    var allMembers = await _readContext.ApplicationMembers
        .Where(m => appIds.Contains(m.ApplicationId) && 
                     m.RelationShipId != (int)Relationship.AuthRep)
        .Select(m => new { m.ApplicationId, m.FirstName, m.LastName, 
                           m.RelationShipId, m.IsMemberDenied })
        .ToListAsync(ct);

    var workerIds = results.Where(r => r.WorkerId.HasValue)
                           .Select(r => r.WorkerId.Value).Distinct().ToList();
    var workers = await _readContext.Users
        .Where(u => workerIds.Contains(u.Id))
        .ToDictionaryAsync(u => u.Id, u => $"{u.FirstName} {u.LastName}", ct);

    var statusIds = results.Select(r => r.Status).Distinct().ToList();
    var statuses = await _dataHelper.GetReferenceValuesBulk(statusIds, ct);

    // Step 3: Map in-memory (0 SQL queries)
    var memberLookup = allMembers.ToLookup(m => m.ApplicationId);
    foreach (var item in results)
    {
        var members = memberLookup[item.Id].ToList();
        item.FullName = members.FirstOrDefault(m => 
            m.RelationShipId == (int)Relationship.PI)?.Let(m => $"{m.FirstName} {m.LastName}");
        item.LockedBy = item.WorkerId.HasValue && workers.TryGetValue(item.WorkerId.Value, out var name) 
            ? name : null;
        item.StatusDescription = statuses.GetValueOrDefault(item.Status, string.Empty);
        item.HasDeniedMembers = members.Any(m => m.IsMemberDenied == true);
    }

    // Total: 4 queries instead of 200+
    return new ManageReferralCdto
    {
        Referrals = results,
        TotalRecords = totalCount,
        References = await _dataHelper.GetReferenceValues((int)ReferenceCodeEnum.ReferralType, ct: ct)
    };
}
```

### 8.2 Query Performance Comparison

| Metric | Current | Redesigned |
|---|---|---|
| SQL queries for 50 referrals | ~200 | 4-5 |
| EF change tracking overhead | YES (bug) | NO (read context) |
| Sync-over-async calls | 4 per row | 0 |
| Thread pool threads blocked | Up to 50 | 0 |
| Memory allocation | High (proxies) | Low (projections) |
