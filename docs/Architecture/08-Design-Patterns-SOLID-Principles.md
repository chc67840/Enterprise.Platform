# 08 — Design Patterns & SOLID Principles

> Complete pattern catalog with RIMS-specific examples and rationale

---

## 1. SOLID Principles — Redesigned

### 1.1 Single Responsibility (S)

| Before | After |
|---|---|
| `ReferralAssembler` (800+ lines): orchestration + mapping + SQL building + reference lookups + validation | `SaveReferralSectionHandler` (~40 lines): orchestrate save only |
| `QueryHelper`: CRUD + raw SQL + save changes + transaction | `GenericRepository`: CRUD only. `ReferralQueryService`: raw SQL only. `UnitOfWork`: transactions only. |

```csharp
// ? Each class has ONE reason to change
public class SaveReferralSectionHandler { }      // Changes when save logic changes
public class ReferralQueryService { }             // Changes when query structure changes
public class GeneralInformationCdtoValidator { }  // Changes when validation rules change
public class ReferralFactory { }                  // Changes when processor registration changes
public class GeneralInformationProcessor { }      // Changes when Gen Info business logic changes
```

### 1.2 Open/Closed (O)

```csharp
// ? EXISTING (kept): Factory + Strategy for processors
// Adding a new referral step requires:
// 1. Create new processor class
// 2. Register in DI with keyed service
// NO changes to existing code

services.AddKeyedScoped<IReferralProcessor, NewStepProcessor>(
    ReferralApplicationPageCodes.NewStep); // ? Just add this line
```

### 1.3 Liskov Substitution (L)

```csharp
// ? All processors are interchangeable via IReferralProcessor
IReferralProcessor processor = factory.Create(pageCode);
// GeneralInformationProcessor, HouseholdCompositionProcessor, etc.
// All implement the same interface, all work correctly when substituted
```

### 1.4 Interface Segregation (I)

```csharp
// ? CURRENT: IRimsDbContext mixes 4 concerns
public interface IRimsDbContext
{
    DbSet<TEntity> Set<TEntity>();           // EF Core infrastructure
    Task<int> SaveChangesAsync();             // Persistence
    Task<ReportsOrrScheduleFCdto> USP_GetOrrScheduleFReportDetails(); // Stored procs
    Task<List<NewArrivalClientDetailsCdto>> SqlQryNewArrivalSearchMember(); // Raw SQL
}

// ? REDESIGNED: Segregated interfaces
public interface IRimsWriteDbContext { DbSet<TEntity> Set<TEntity>(); Task<int> SaveChangesAsync(); }
public interface IRimsReadDbContext  { DbSet<TEntity> Set<TEntity>(); }
public interface IRimsStoredProcedures { Task<T> Execute<T>(string procName, params SqlParameter[] parameters); }
public interface IRimsRawQueries { Task<List<T>> Query<T>(FormattableString sql); }
```

### 1.5 Dependency Inversion (D)

```csharp
// ? CURRENT: Business layer depends on concrete RimsContext
public class CommonAssemblerBehavior(IRimsDbContext context)
{
    protected RimsContext DbContext { get; set; } = (RimsContext)context; // CAST!
}

// ? REDESIGNED: Business layer depends on abstractions only
public class SaveReferralSectionHandler(
    IUnitOfWork unitOfWork,                    // Abstraction
    IFactory<IReferralProcessor, ReferralApplicationPageCodes> factory,  // Abstraction
    ILogHandler logger)                        // Abstraction
{
    // No concrete types. No casts. Fully mockable.
}
```

---

## 2. Pattern Catalog

### 2.1 Factory Pattern (Existing — Enhanced)

```csharp
// ? ENHANCED: Constructor injection instead of property injection
public class ReferralFactory(
    Func<ReferralApplicationPageCodes, IReferralProcessor> factory)
    : FactoryBase<IReferralProcessor, ReferralApplicationPageCodes>(factory)
{
    // No more manual property injection!
    // .NET 8 keyed DI handles all dependencies via constructor injection
    public override IReferralProcessor Create(ReferralApplicationPageCodes enumType)
    {
        return base.Create(enumType);
        // Dependencies are injected by DI into each processor's constructor
    }
}
```

### 2.2 Strategy Pattern (Existing)

```csharp
// Each page in the referral wizard has its own strategy
public interface IReferralProcessor
{
    Task<IReferralCdto> GetPageData(ReferralApplicationDetailCdto details, CancellationToken ct);
    Task<ReferralApplicationDetailCdto> SavePageData(IReferralCdto pageData, CancellationToken ct);
}
// 10 concrete implementations, selected by ReferralFactory
```

### 2.3 Template Method Pattern (Existing)

```csharp
// Base class defines the algorithm, subclasses implement steps
public abstract class ReferralProcessorBase<TCdto> : IReferralProcessor
{
    // Template method — final algorithm
    public async Task<IReferralCdto> GetPageData(...)
    {
        var cdto = new TCdto() { ReferralDetails = details };
        await PopulateSectionData(cdto, ct);  // ? Subclass implements
        return cdto;
    }

    // Abstract steps
    public abstract Task PopulateSectionData(TCdto cdto, CancellationToken ct);
    public abstract Task<ReferralApplicationDetailCdto> SaveSectionData(TCdto data, CancellationToken ct);
}
```

### 2.4 Pipeline / Chain of Responsibility (New)

```csharp
// CQRS pipeline behaviors execute in order
Request ? LoggingBehavior ? ValidationBehavior ? TransactionBehavior ? Handler ? Response

public class LoggingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
{
    public async Task<TResponse> Handle(TRequest request,
        RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        logger.LogInformation("Handling {RequestType}", typeof(TRequest).Name);

        var response = await next(); // Pass to next behavior in chain

        sw.Stop();
        logger.LogInformation("Handled {RequestType} in {ElapsedMs}ms",
            typeof(TRequest).Name, sw.ElapsedMilliseconds);
        return response;
    }
}
```

### 2.5 Specification Pattern (New)

```csharp
// Reusable, composable query specifications
public interface ISpecification<T>
{
    Expression<Func<T, bool>> Criteria { get; }
    List<Expression<Func<T, object>>> Includes { get; }
    Expression<Func<T, object>>? OrderBy { get; }
}

public class ActiveCasesInCountySpec : ISpecification<CaseManagement>
{
    public ActiveCasesInCountySpec(int countyId)
    {
        Criteria = c => c.CountyId == countyId && 
                        c.StatusId == (int)CaseStatus.Active;
        Includes = new() { c => c.CaseCompositions };
        OrderBy = c => c.CreatedDate;
    }
}

// Usage
var spec = new ActiveCasesInCountySpec(countyId: 42);
var cases = await unitOfWork.Repository<CaseManagement>()
    .QueryBySpec(spec)
    .ToListAsync(ct);
```

### 2.6 Domain Events (New)

```csharp
// Decouple side effects from main operations
public interface IDomainEvent { DateTime OccurredOn { get; } }

public record ReferralApprovedEvent(
    long ApplicationId, 
    long SessionId) : IDomainEvent
{
    public DateTime OccurredOn => DateTime.UtcNow;
}

// Raised in handler
public class ApproveReferralHandler : ICommandHandler<ApproveReferralCommand, ApplicationDto>
{
    public async Task<ApplicationDto> Handle(...)
    {
        // ... approval logic ...

        // Raise event — handled asynchronously
        await _eventBus.Publish(new ReferralApprovedEvent(applicationId, sessionId));

        return result;
    }
}

// Side effect handler — creates case from approved referral
public class CreateCaseOnReferralApproved : IDomainEventHandler<ReferralApprovedEvent>
{
    public async Task Handle(ReferralApprovedEvent e, CancellationToken ct)
    {
        // Create CaseManagement from approved referral
        // This is decoupled from the approval logic
    }
}
```

### 2.7 Value Objects (New)

```csharp
// Encapsulate PHI with validation and formatting
public record SSN
{
    private readonly string _value;

    public SSN(string value)
    {
        if (string.IsNullOrWhiteSpace(value) || !Regex.IsMatch(value, @"^\d{9}$"))
            throw new ValidationException("Invalid SSN format");
        _value = value;
    }

    public string Masked => $"***-**-{_value[5..]}";
    public string Full => $"{_value[..3]}-{_value[3..5]}-{_value[5..]}";
    public override string ToString() => Masked; // Never accidentally log full SSN

    public static implicit operator string(SSN ssn) => ssn._value;
}
```

### 2.8 Result Pattern (New)

```csharp
// Replace exceptions for expected business outcomes
public class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public string? Error { get; }
    public ErrorCode? Code { get; }

    public static Result<T> Success(T value) => new() { IsSuccess = true, Value = value };
    public static Result<T> Failure(string error, ErrorCode code) => 
        new() { IsSuccess = false, Error = error, Code = code };
}

// Usage — no exception for business rule violations
public async Task<Result<ApplicationDto>> DenyReferral(DenialReferralCdto cdto, CancellationToken ct)
{
    var app = await unitOfWork.Repository<Application>()
        .GetByIdAsync(a => a.Id == cdto.ApplicationId, ct);

    if (app == null)
        return Result<ApplicationDto>.Failure("Application not found", ErrorCode.NotFound);

    if (app.Status == (int)ApplicationStatus.Referral_Approved)
        return Result<ApplicationDto>.Failure("Cannot deny an approved referral", ErrorCode.BusinessRule);

    // ... denial logic ...
    return Result<ApplicationDto>.Success(app.GetDto());
}
```

---

## 3. Pattern Summary

| Pattern | Where Used | Purpose |
|---|---|---|
| Factory | `ReferralFactory`, `FileFactory` | Resolve processors by enum key |
| Strategy | `IReferralProcessor` implementations | Different logic per referral page |
| Template Method | `ReferralProcessorBase`, `FileProcessorBase` | Shared algorithm, custom steps |
| Repository | `GenericRepository<T>` | Abstract data access |
| Unit of Work | `UnitOfWork` | Transaction boundary |
| Pipeline/CoR | `IPipelineBehavior<,>` | Cross-cutting concerns in CQRS |
| CQRS | Commands + Queries | Read/write separation |
| Specification | `ISpecification<T>` | Reusable query criteria |
| Domain Events | `IDomainEvent` handlers | Decouple side effects |
| Value Object | `SSN`, `AlienNumber`, `Address` | Encapsulate PHI with validation |
| Result | `Result<T>` | Business outcomes without exceptions |
| Builder | `Application.Configure.With()` | Fluent entity construction |
| BFF | `Web.UI` ? `App.WebApi` | Separate auth boundaries |
