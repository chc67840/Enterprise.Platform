# 08 — Database + Persistence (EF Core 10)

> **Output of this doc.** Per-database `DbContext`, `IDbContextFactory`
> abstraction, per-entity configurations, interceptors (audit/soft-delete/
> encryption), migrations, seeding, repositories, Unit of Work, and the
> transactional outbox pattern.

## 1. Database topology

| Logical name | Connection-string key | Purpose |
|---|---|---|
| **EventShopper** | `EventShopperDb` | First domain context — customers, orders, events, payments, audit logs, outbox |
| **PlatformDb** (D4-deferred) | `PlatformDb` | Identity, roles, permissions, refresh-token store, tenant mapping |

Each logical database gets its own `DbContext`. **Never** combine two domain
contexts into one — they should evolve independently.

## 2. Connection-string convention

`appsettings.json`:

```json
{
  "ConnectionStrings": {
    "EventShopperDb": "Data Source=localhost;Initial Catalog=EventShopperDb;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;..."
  },
  "DatabaseSettings": {
    "DefaultConnection": "EventShopper",
    "Connections": {
      "EventShopper": {
        "ConnectionStringName": "EventShopperDb",
        "Provider": "SqlServer",
        "CommandTimeoutSeconds": 0,
        "IsReadReplica": false,
        "EnableSensitiveDataLogging": false,
        "EnableDetailedErrors": true
      }
    }
  }
}
```

The two-level structure exists so `DatabaseSettings.Connections[name]` can
carry per-DB metadata (provider, timeouts, replica flag) without polluting
the `ConnectionStrings` section.

## 3. `DbContext` per domain

### 3.1 `EventShopperDbContext.cs`

```csharp
namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Contexts;

public class EventShopperDbContext(DbContextOptions<EventShopperDbContext> options)
    : DbContext(options)
{
    public virtual DbSet<Customers> Customers { get; set; } = null!;
    public virtual DbSet<Orders> Orders { get; set; } = null!;
    public virtual DbSet<Payments> Payments { get; set; } = null!;
    public virtual DbSet<AuditLogs> AuditLogs { get; set; } = null!;
    public virtual DbSet<OutboxMessages> OutboxMessages { get; set; } = null!;
    // ... ~40 more entities

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Apply ALL IEntityTypeConfiguration<T> in the assembly.
        // This pulls in per-entity files from Persistence/Configurations/
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(EventShopperDbContext).Assembly);
    }
}
```

### 3.2 Per-entity configuration

`Persistence/Configurations/CustomersConfiguration.cs`:

```csharp
internal sealed class CustomersConfiguration : IEntityTypeConfiguration<Customers>
{
    public void Configure(EntityTypeBuilder<Customers> entity)
    {
        entity.ToTable("Customers");
        entity.HasKey(e => e.Id);
        entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
        entity.Property(e => e.Email).HasMaxLength(320).IsRequired();
        entity.HasIndex(e => e.Email).IsUnique();
        entity.Property(e => e.RowVersion).IsRowVersion();
    }
}
```

Centralizing configurations keeps the `OnModelCreating` slim. Each entity
gets its own file — easy to find, easy to review.

## 4. `IDbContextFactory` + `DbContextRegistry` pattern

The Application layer never depends on a concrete `DbContext` — it depends
on an abstraction so handler code is testable.

### 4.1 Application abstraction

```csharp
// src/Core/Enterprise.Platform.Application/Abstractions/IDbContextFactory.cs
public interface IDbContextFactory
{
    TContext Get<TContext>() where TContext : DbContext;
}
```

### 4.2 Infrastructure implementation

```csharp
internal sealed class DbContextFactory(IServiceProvider provider) : IDbContextFactory
{
    public TContext Get<TContext>() where TContext : DbContext =>
        provider.GetRequiredService<TContext>();
}
```

### 4.3 Registration

```csharp
// AddPlatformInfrastructure
services.AddDbContext<EventShopperDbContext>((sp, opts) =>
{
    var db = sp.GetRequiredService<IOptions<DatabaseSettings>>().Value;
    var conn = db.Connections[db.DefaultConnection];
    var configuration = sp.GetRequiredService<IConfiguration>();
    var connectionString = configuration.GetConnectionString(conn.ConnectionStringName);

    opts.UseSqlServer(connectionString, sql =>
    {
        sql.CommandTimeout(conn.CommandTimeoutSeconds);
        sql.MigrationsAssembly(typeof(EventShopperDbContext).Assembly.FullName);
        sql.EnableRetryOnFailure(3);
    });

    if (conn.EnableSensitiveDataLogging) opts.EnableSensitiveDataLogging();
    if (conn.EnableDetailedErrors) opts.EnableDetailedErrors();

    // Wire interceptors (audit, soft-delete, encryption)
    opts.AddInterceptors(
        sp.GetRequiredService<AuditingSaveChangesInterceptor>(),
        sp.GetRequiredService<SoftDeleteSaveChangesInterceptor>());
});

services.AddScoped<IDbContextFactory, DbContextFactory>();
```

### 4.4 Usage in handlers

```csharp
public sealed class GetCustomerByIdHandler(IDbContextFactory dbFactory)
    : IQueryHandler<GetCustomerByIdQuery, CustomerDto>
{
    public async Task<CustomerDto> Handle(GetCustomerByIdQuery query, CancellationToken ct)
    {
        var db = dbFactory.Get<EventShopperDbContext>();
        var customer = await db.Customers.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == query.Id, ct);
        return customer?.Adapt<CustomerDto>() ?? throw new NotFoundException();
    }
}
```

## 5. Interceptors (cross-cutting save-time concerns)

Interceptors run inside `SaveChangesAsync` — perfect for cross-cutting
concerns that must apply to EVERY save.

### 5.1 `AuditingSaveChangesInterceptor`

Stamps `CreatedAt` / `CreatedBy` on inserts; `ModifiedAt` / `ModifiedBy` on
updates. Reads `ICurrentUserService` for the actor.

```csharp
public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
    DbContextEventData eventData, InterceptionResult<int> result, CancellationToken ct)
{
    var ctx = eventData.Context!;
    var userId = currentUser.UserId ?? "system";
    var now = DateTimeOffset.UtcNow;

    foreach (var entry in ctx.ChangeTracker.Entries<AuditableEntity>())
    {
        if (entry.State == EntityState.Added)
        {
            entry.Entity.CreatedAt = now;
            entry.Entity.CreatedBy = userId;
        }
        if (entry.State == EntityState.Modified)
        {
            entry.Entity.ModifiedAt = now;
            entry.Entity.ModifiedBy = userId;
        }
    }
    return base.SavingChangesAsync(eventData, result, ct);
}
```

> **Important:** scoped services consumed in interceptors (`ICurrentUserService`)
> must be resolved at save-time, not capture-time. Inject `IServiceProvider`
> into the interceptor and `GetRequiredService` inside `SavingChangesAsync`.
> See [`feedback_dbcontextpool_gotchas`](../../C:/Users/hkgou/.claude/...) memory.

### 5.2 `SoftDeleteSaveChangesInterceptor`

Converts `EntityState.Deleted` on `ISoftDeletable` entities into an UPDATE
that flips `IsDeleted = true` + records `DeletedAt`/`DeletedBy`.

### 5.3 Encryption interceptor (Compliance-TODO 2.5)

Per-column encryption via EF value converters tied to Azure Key Vault.
Currently NOT implemented — pattern proposed in Compliance-TODO.

## 6. Migrations

### 6.1 Generate

```bash
cd src/Infrastructure/Enterprise.Platform.Infrastructure
dotnet ef migrations add InitialCreate \
  --context EventShopperDbContext \
  --output-dir Persistence/Migrations \
  --startup-project ../../API/Enterprise.Platform.Api
```

### 6.2 Apply

```bash
dotnet ef database update \
  --context EventShopperDbContext \
  --startup-project ../../API/Enterprise.Platform.Api
```

### 6.3 Rollback

```bash
dotnet ef migrations remove --context EventShopperDbContext \
  --startup-project ../../API/Enterprise.Platform.Api
```

### 6.4 Generate idempotent SQL script (for prod)

```bash
dotnet ef migrations script <FromMigration> <ToMigration> \
  --idempotent \
  --output deploy/eventshopper-migrate.sql
```

## 7. Seeding

`Persistence/Seeding/EventShopperSeeder.cs` runs on startup (or via a CLI
command) to populate static lookup data:

```csharp
public sealed class EventShopperSeeder(EventShopperDbContext db, ILogger<EventShopperSeeder> log)
{
    public async Task SeedAsync(CancellationToken ct)
    {
        if (!await db.OrderStatuses.AnyAsync(ct))
        {
            db.OrderStatuses.AddRange(
                new() { Id = 1, Name = "Pending" },
                new() { Id = 2, Name = "Confirmed" },
                // ...
            );
            await db.SaveChangesAsync(ct);
        }
    }
}
```

Wire in Program.cs after `app.Build()`:

```csharp
using (var scope = app.Services.CreateScope())
{
    var seeder = scope.ServiceProvider.GetRequiredService<EventShopperSeeder>();
    await seeder.SeedAsync(default);
}
```

## 8. Repositories + Unit of Work

### 8.1 `IUnitOfWork` (Domain abstraction)

```csharp
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct);
    Task BeginTransactionAsync(CancellationToken ct);
    Task CommitTransactionAsync(CancellationToken ct);
    Task RollbackTransactionAsync(CancellationToken ct);
    ValueTask DisposeAsync();
}
```

### 8.2 `UnitOfWork<TContext>` (Infrastructure)

```csharp
public sealed class UnitOfWork<TContext>(TContext context) : IUnitOfWork
    where TContext : DbContext
{
    private IDbContextTransaction? _transaction;

    public Task<int> SaveChangesAsync(CancellationToken ct)
        => context.SaveChangesAsync(ct);

    public async Task BeginTransactionAsync(CancellationToken ct)
    {
        if (_transaction is not null) return;   // nested begin = no-op
        _transaction = await context.Database.BeginTransactionAsync(ct);
    }

    public async Task CommitTransactionAsync(CancellationToken ct)
    {
        if (_transaction is null) return;
        await _transaction.CommitAsync(ct);
        await _transaction.DisposeAsync();
        _transaction = null;
    }

    // ...
}
```

### 8.3 Per-aggregate repositories (optional)

```csharp
public sealed class CustomersRepository(EventShopperDbContext db) : ICustomersRepository
{
    public Task<Customer?> GetByIdAsync(Guid id, CancellationToken ct)
        => db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct);

    public void Add(Customer customer) => db.Customers.Add(customer);
}
```

Some teams prefer pure DbContext access in handlers — both are valid.
Repositories shine for complex aggregate composition; raw EF works for
simple CRUD.

## 9. Outbox pattern (transactional event publishing)

Problem: emitting integration events to a broker MUST happen atomically with
the SQL transaction. Otherwise: rollback leaves an event published; commit
without publish loses the event.

Solution: write events to an `OutboxMessages` table inside the transaction;
a background worker drains them to the broker.

### 9.1 `OutboxMessages` entity

```csharp
public sealed class OutboxMessages
{
    public Guid Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ProcessedAt { get; set; }
    public int AttemptCount { get; set; }
    public string? LastError { get; set; }
    // Indexes: ProcessedAt (for unprocessed query), CreatedAt
}
```

### 9.2 Producer side (in handler)

```csharp
public sealed class CreateOrderHandler(EventShopperDbContext db, IUnitOfWork uow)
    : ICommandHandler<CreateOrderCommand, OrderId>
{
    public async Task<OrderId> Handle(CreateOrderCommand cmd, CancellationToken ct)
    {
        await uow.BeginTransactionAsync(ct);
        try
        {
            var order = new Order { /* ... */ };
            db.Orders.Add(order);

            db.OutboxMessages.Add(new OutboxMessages
            {
                Id = Guid.NewGuid(),
                EventType = nameof(OrderCreatedIntegrationEvent),
                Payload = JsonSerializer.Serialize(new OrderCreatedIntegrationEvent(order.Id)),
                CreatedAt = DateTimeOffset.UtcNow,
            });

            await uow.SaveChangesAsync(ct);
            await uow.CommitTransactionAsync(ct);
            return order.Id;
        }
        catch
        {
            await uow.RollbackTransactionAsync(ct);
            throw;
        }
    }
}
```

### 9.3 Consumer side (Worker → `OutboxProcessorJob`)

Already covered in [`05-Backend-Request-Flow.md`](05-Backend-Request-Flow.md) §5.2.
Briefly:

```csharp
while (!stoppingToken.IsCancellationRequested)
{
    var batch = await db.OutboxMessages
        .Where(m => m.ProcessedAt == null && m.AttemptCount < 5)
        .OrderBy(m => m.CreatedAt)
        .Take(batchSize)
        .ToListAsync(ct);

    foreach (var message in batch)
    {
        try
        {
            await broker.PublishAsync(message.EventType, message.Payload, ct);
            message.ProcessedAt = DateTimeOffset.UtcNow;
        }
        catch (Exception ex)
        {
            message.AttemptCount++;
            message.LastError = ex.Message;
        }
    }

    await db.SaveChangesAsync(ct);
    await Task.Delay(pollInterval, ct);
}
```

## 10. Multi-tenancy

`MultiTenancySettings.IsolationMode` chooses:

- **`SharedDatabase`** (current) — one DbContext, one DB; tenant id is a
  column on every multi-tenant table; `ICurrentTenantService` returns the
  tenant id from claims/header; query filters apply automatically.

- **`DatabasePerTenant`** (future) — `IDbContextFactory.Get<TContext>()`
  picks the connection string by tenant id at resolution time.

Global query filter pattern (in `OnModelCreating` of relevant entities):

```csharp
modelBuilder.Entity<Order>().HasQueryFilter(o => o.TenantId == _currentTenant.TenantId);
```

> Caveat: query filters need access to `ICurrentTenantService` at model-build
> time. Resolve via captured `IServiceProvider` AND know that interceptor
> services may need to be Singleton — see
> [`feedback_dbcontextpool_gotchas`](../../C:/Users/hkgou/.claude/...) memory.

## 11. Verification

```bash
# Apply migrations
cd src/Infrastructure/Enterprise.Platform.Infrastructure
dotnet ef database update --context EventShopperDbContext \
  --startup-project ../../API/Enterprise.Platform.Api

# Verify the database exists + has the expected tables
sqlcmd -S localhost -E -d EventShopperDb -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_NAME"
```

Expected: tables for every entity declared in `EventShopperDbContext`,
plus `__EFMigrationsHistory`.

---

**Next:** [`09-Observability.md`](09-Observability.md) — Serilog,
OpenTelemetry, OTLP, custom metrics, correlation propagation.
