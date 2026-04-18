# 09 — Caching & Performance Strategy

> Multi-layer caching, N+1 prevention, compiled queries, batch optimization

---

## 1. Multi-Layer Caching

### 1.1 Cache Hierarchy

```
Layer 1: Angular (sessionStorage)     ? User session, preferences, nav menus
Layer 2: In-Memory (ICacheProvider)    ? Reference values, counties, states
Layer 3: Distributed (Redis — future)  ? Cross-instance shared data
Layer 4: EF Core Query Cache          ? Compiled queries for hot paths
Layer 5: SQL Server (buffer pool)     ? Database engine caching
```

### 1.2 Reference Data Caching (Enhanced)

```csharp
public class CachedReferenceDataService : IReferenceDataService
{
    private readonly ICacheProvider _cache;
    private readonly RimsReadDbContext _readContext;

    public async Task<List<ReferenceValueDto>> GetReferenceValues(
        int referenceCodeId, CancellationToken ct = default)
    {
        var cacheKey = CacheKeys.ReferenceValues(referenceCodeId);

        return await _cache.GetOrCreateAsync(cacheKey, async () =>
        {
            return await _readContext.ReferenceValues
                .Where(x => x.ReferenceCodeId == referenceCodeId && x.IsActive)
                .OrderBy(x => x.Sequence)
                .Select(r => r.GetDto())
                .ToListAsync(ct);
        }, 
        slidingExpiration: TimeSpan.FromMinutes(30),
        absoluteExpiration: TimeSpan.FromHours(4));
    }

    public async Task<Dictionary<int, string>> GetReferenceValuesBulk(
        IEnumerable<int> ids, CancellationToken ct = default)
    {
        var result = new Dictionary<int, string>();
        var uncachedIds = new List<int>();

        // Check cache first
        foreach (var id in ids.Distinct())
        {
            var cached = _cache.Get<string>(CacheKeys.ReferenceValueById(id));
            if (cached != null)
                result[id] = cached;
            else
                uncachedIds.Add(id);
        }

        // Batch load uncached values (single query)
        if (uncachedIds.Any())
        {
            var values = await _readContext.ReferenceValues
                .Where(r => uncachedIds.Contains(r.Id))
                .ToDictionaryAsync(r => r.Id, r => r.Description, ct);

            foreach (var kvp in values)
            {
                result[kvp.Key] = kvp.Value;
                _cache.Set(CacheKeys.ReferenceValueById(kvp.Key), kvp.Value,
                    TimeSpan.FromMinutes(30));
            }
        }

        return result;
    }

    // Cache invalidation on configuration changes
    public void InvalidateReferenceCache(int referenceCodeId)
    {
        _cache.Remove(CacheKeys.ReferenceValues(referenceCodeId));
    }
}

public static class CacheKeys
{
    public static string ReferenceValues(int codeId) => $"refval:list:{codeId}";
    public static string ReferenceValueById(int id) => $"refval:id:{id}";
    public static string Counties => "ref:counties";
    public static string States => "ref:states";
    public static string Countries => "ref:countries";
    public static string StateWorkdays(int year) => $"ref:workdays:{year}";
    public static string ActivePaymentConfig => "config:payment:active";
}
```

### 1.3 Caching Pipeline Behavior

```csharp
public interface ICacheable
{
    string CacheKey { get; }
    TimeSpan? CacheDuration { get; }
}

public class CachingBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : ICacheable
{
    private readonly ICacheProvider _cache;

    public async Task<TResponse> Handle(TRequest request,
        RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        var cached = _cache.Get<TResponse>(request.CacheKey);
        if (cached != null) return cached;

        var response = await next();

        _cache.Set(request.CacheKey, response, request.CacheDuration ?? TimeSpan.FromMinutes(5));
        return response;
    }
}

// Usage
public record GetDropdownValuesQuery(int CodeId) : IQuery<List<ReferenceValueDto>>, ICacheable
{
    public string CacheKey => CacheKeys.ReferenceValues(CodeId);
    public TimeSpan? CacheDuration => TimeSpan.FromMinutes(30);
}
```

---

## 2. N+1 Query Prevention

### 2.1 Current Problem ? Solution

```csharp
// ? CURRENT: N+1 in FetchAllReferral (200+ queries for 50 referrals)
var referrals = results.Select(item =>
{
    // Query per row (N+1)
    var members = queryHelper.QueryAsync<ApplicationMember>()
        .Where(y => y.ApplicationId == item.Id).ToList();
    item.StatusDescription = dataHelper.GetReferenceValue(item.Status)
        .GetAwaiter().GetResult(); // BLOCKING!
    return item;
}).ToList();

// ? REDESIGNED: Batch loading (4-5 queries total)
var appIds = results.Select(r => r.Id).ToList();

// 1 query for ALL members
var memberLookup = await _readContext.ApplicationMembers
    .Where(m => appIds.Contains(m.ApplicationId))
    .Select(m => new { m.ApplicationId, m.FirstName, m.LastName, m.RelationShipId })
    .ToListAsync(ct)
    .ContinueWith(t => t.Result.ToLookup(m => m.ApplicationId));

// 1 query for ALL statuses (or from cache)
var statusMap = await _referenceService.GetReferenceValuesBulk(
    results.Select(r => r.Status).Distinct(), ct);

// Map in-memory (0 queries)
foreach (var item in results)
{
    var members = memberLookup[item.Id];
    item.FullName = members.FirstOrDefault(m => m.RelationShipId == (int)Relationship.PI)
        ?.Let(m => $"{m.FirstName} {m.LastName}");
    item.StatusDescription = statusMap.GetValueOrDefault(item.Status, "");
}
```

---

## 3. Compiled Queries

```csharp
// For queries executed on EVERY request (reference lookups, session validation)
public static class CompiledQueries
{
    public static readonly Func<RimsReadDbContext, int, Task<ReferenceValue?>>
        GetReferenceValueById = EF.CompileAsyncQuery(
            (RimsReadDbContext ctx, int id) =>
                ctx.ReferenceValues.FirstOrDefault(r => r.Id == id));

    public static readonly Func<RimsReadDbContext, long, Task<User?>>
        GetUserById = EF.CompileAsyncQuery(
            (RimsReadDbContext ctx, long id) =>
                ctx.Users.FirstOrDefault(u => u.Id == id));

    public static readonly Func<RimsReadDbContext, long, Task<Application?>>
        GetApplicationById = EF.CompileAsyncQuery(
            (RimsReadDbContext ctx, long id) =>
                ctx.Applications.FirstOrDefault(a => a.Id == id));
}
```

---

## 4. Batch Processing Optimization

```csharp
// For batch jobs that process thousands of records
public class BatchOptimizedProcessor
{
    public async Task ProcessInChunks<T>(
        IEnumerable<T> items,
        Func<IEnumerable<T>, Task> processChunk,
        int chunkSize = 100,
        CancellationToken ct = default)
    {
        foreach (var chunk in items.Chunk(chunkSize))
        {
            ct.ThrowIfCancellationRequested();

            await processChunk(chunk);

            // Clear change tracker between chunks to prevent memory growth
            _writeContext.ChangeTracker.Clear();
        }
    }
}
```

---

## 5. Response Compression

```csharp
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(
        new[] { "application/json", "text/json" });
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
    options.Level = CompressionLevel.Fastest);

app.UseResponseCompression(); // Before UseStaticFiles
```

---

## 6. Performance Summary

| Area | Before | After | Improvement |
|---|---|---|---|
| FetchAllReferral (50 records) | ~200 SQL queries | 4-5 queries | **40x fewer queries** |
| EF Change tracking on reads | Enabled (bug) | Disabled (read context) | **~30% memory reduction** |
| Reference value lookups | DB query per call | Cached + bulk load | **~95% fewer DB calls** |
| Sync-over-async (.GetAwaiter()) | 4 blocking calls/row | 0 blocking calls | **Eliminates deadlock risk** |
| Response payload | Uncompressed JSON | Brotli compressed | **~70% smaller responses** |
| Batch processing (1000 records) | Single transaction | 100-record chunks | **Prevents timeout** |
