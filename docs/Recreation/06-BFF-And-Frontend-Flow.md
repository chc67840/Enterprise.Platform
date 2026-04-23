# 06 — BFF + Frontend Request Flow + Interceptors

> **Output of this doc.** A precise, in-order walkthrough of:
> 1. The **BFF middleware + endpoint pipeline** at `:5001`
> 2. The **Angular HTTP interceptor chain** in execution order
> 3. The **end-to-end browser → BFF → Api trace** for both a simple GET and
>    a mutating POST

## 1. BFF middleware pipeline (in order)

`Program.cs` registration order = request execution order. Reading top-down:

```
Browser request
    │
    ▼
[1] Kestrel                                                 0 ms
    │
    ▼
[2] SecurityHeadersMiddleware                              <1 ms
       Mints per-request CSP nonce → HttpContext.Items["ep.csp.nonce"]
       Registers Response.OnStarting → on first body write,
         sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
         Permissions-Policy, HSTS (HTTPS only), CSP with nonce
    │
    ▼
[3] CorrelationIdMiddleware                                <1 ms
       Reads X-Correlation-ID from Request.Headers, mints fresh GUID if absent
       Echoes on Response.Headers["X-Correlation-ID"]
       Pushes to Serilog LogContext
    │
    ▼
[4] DeveloperExceptionPage (Dev) OR JSON ProblemDetails ExceptionHandler (Prod)
    │
    ▼
[5] UseHttpsRedirection (Production only — skipped in Dev)
    │
    ▼
[6] UseStaticFiles                                         <1 ms
       Resolves SpaHosting:StaticRoot via SpaFallbackEndpoint.ResolveStaticRoot:
         non-empty → serve from Angular dist/<project>/browser/
         empty     → serve from wwwroot/
       Short-circuits for matched files (CSS, JS, assets)
    │
    ▼
[7] UseRouting                                             <1 ms
       Matches incoming path to a registered endpoint
    │
    ▼
[8] UseCors(PlatformCorsSetup.PolicyName = "ep-web-ui")    <1 ms
       Almost always no-op — SPA is same-origin
       Only matters for tooling clients (Postman, Bruno) hitting cross-origin
    │
    ▼
[9] UseRateLimiter                                          <1 ms
       Chained partitioned token-bucket policies:
         (a) per-session  (120/min, key = ep.bff.session cookie or IP)
         (b) per-IP       (600/min, key = remote IP)
       OIDC paths (signin-oidc, signout-callback-oidc) + /health/* exempt
       429 with Retry-After when exhausted
    │
    ▼
[10] UseAuthentication                                      ~3 ms
       Cookie scheme reads ep.bff.session
       OnValidatePrincipal fires → TokenRefreshService.ValidateAsync:
         reads stashed access_token expires_at,
         if < 5min remaining → POSTs refresh_token to Entra,
         on success: StoreTokens + ShouldRenew=true,
         on failure: RejectPrincipal()
       For unauth requests + DefaultChallengeScheme=OidcScheme:
         → Challenge issues 302 to Entra authorize endpoint
    │
    ▼
[11] UseAuthorization                                       <1 ms
       Walks endpoint metadata for [Authorize(...)] attributes
    │
    ▼
[12] Health endpoints map (anonymous)
       /health/live → liveness self-check
       /health/ready → DownstreamApiHealthCheck (probes Api /health/live)
    │
    ▼
[13] MapControllers (matches /api/auth/*, /api/proxy/*, /api/antiforgery/*)
       AntiForgery filter (AutoValidateAntiforgeryToken on ProxyController):
         on POST/PUT/PATCH/DELETE: reads X-XSRF-TOKEN header,
         validates against __RequestVerificationToken cookie value;
         400 on mismatch
    │
    ▼
[14] MapSpaFallback                                          <1 ms
       For unmatched routes (Angular client-side routes), serves
       index.html from SpaHosting:StaticRoot. The {**catchAll}
       pattern includes file-extensioned paths.
       /api/* / /signin-oidc* / /health/* prefixes early-return 404
       to avoid serving HTML for missed API calls.
    │
    ▼
[15] ProxyController.Forward (when /api/proxy/{**downstreamPath})
       Builds target URI: Proxy.ApiBaseUri + downstreamPath + query
       Forwards body, headers (minus hop-by-hop)
       Reads stashed access_token from cookie ticket → Authorization: Bearer
       Copies X-Correlation-ID outbound (server-to-server trace)
       Calls downstream Api via IHttpClientFactory("ep-proxy-api")
       Streams response status + headers + body back
       LogHop emits structured log per round-trip
    │
    ▼
Response back through middleware (later registrations exit first)
SecurityHeadersMiddleware writes its headers (OnStarting fired)
Kestrel writes bytes
```

## 2. Angular HTTP interceptor chain (execution order)

Registered in `src/app/config/app.config.ts` via `provideHttpClient(withInterceptors([...]))`.
Request flows top → bottom; response flows bottom → top.

### 2.1 Registration order = execution order on request

```typescript
provideHttpClient(
  withXsrfConfiguration({
    cookieName: 'XSRF-TOKEN',
    headerName: 'X-XSRF-TOKEN',
  }),
  withInterceptors([
    correlationInterceptor,    // [1]
    tenantInterceptor,         // [2]
    securityInterceptor,       // [3]
    cacheInterceptor,          // [4]
    dedupInterceptor,          // [5]
    loadingInterceptor,        // [6]
    loggingInterceptor,        // [7]
    retryInterceptor,          // [8]
    errorInterceptor,          // [9]
  ]),
),
```

### 2.2 Per-interceptor behavior

| # | Interceptor | Request side (top→bottom) | Response side (bottom→top) |
|---|---|---|---|
| 1 | **correlationInterceptor** | Mints X-Correlation-ID if not present, attaches header | (passthrough) |
| 2 | **tenantInterceptor** | Attaches X-Tenant-ID from `TenantService.current()` | (passthrough) |
| 3 | **securityInterceptor** | For same-origin `/api/*`: attaches X-Requested-With, X-Content-Type-Options, AND X-XSRF-TOKEN (read from XSRF-TOKEN cookie) | (passthrough) |
| 4 | **cacheInterceptor** | For GET requests with `[Cacheable]` shape: returns `of(cachedResponse)` short-circuit if cache hit; otherwise proceeds | On success: writes response to cache keyed by URL+query |
| 5 | **dedupInterceptor** | For GET requests: if identical URL is in-flight, returns the same Observable (uses `share()` + per-key map) | `finalize()` removes the in-flight entry |
| 6 | **loadingInterceptor** | Increments a global "in-flight count" signal (drives any spinner) | Decrements the count (in `finalize()`) |
| 7 | **loggingInterceptor** | Logs `http.request` with method, URL, correlationId | Logs `http.response` with status, elapsed; OR `http.error` with status, errorBody |
| 8 | **retryInterceptor** | (passthrough) | On retryable errors (5xx, 408, 429, network), retries with exponential backoff: 250ms → 500ms → 1s. Max 3 attempts. Idempotent verbs only (GET/HEAD/PUT/DELETE) |
| 9 | **errorInterceptor** | (passthrough) | Maps HTTP status codes to UX side-effects:<br>• 0 → "You appear offline" toast<br>• 401 → "Session expired" sticky toast + Router.navigate('/auth/login')<br>• 403 → "Access denied" + Router.navigate('/error/forbidden')<br>• 404 → no-op<br>• 409 → "Record changed" warning (optimistic concurrency)<br>• 5xx → generic error toast |

### 2.3 Order rationale

- **correlation FIRST** — every other interceptor's logs need the id
- **tenant before security** — XSRF-TOKEN needs no tenant context, but
  X-Tenant-ID needs to be present BEFORE security tries to log a clean
  request line
- **cache before dedup** — a cached hit shouldn't even appear in dedup map
- **dedup before loading** — dedup'd requests don't move the loading needle
- **logging after retry** — only logs the FINAL outcome, not retry attempts
- **errorInterceptor LAST** — catches everything anything else might throw;
  side-effects (toasts, redirects) need access to fully-resolved error

### 2.4 XSRF (`withXsrfConfiguration`) — Angular built-in

This is NOT an interceptor in the array — it's a separate built-in middleware
Angular wires when `withXsrfConfiguration` is called. It:

- Reads `XSRF-TOKEN` cookie (set by BFF's `AntiForgeryController.GetToken`)
- Echoes value as `X-XSRF-TOKEN` header on **mutating** verbs (POST/PUT/PATCH/DELETE)
- Skips safe verbs (GET/HEAD/OPTIONS) and cross-origin requests

The `securityInterceptor` ALSO sets `X-XSRF-TOKEN` for same-origin `/api/*`
calls — belt-and-braces in case Angular's built-in changes behavior.

## 3. End-to-end trace — GET request (Test now → whoami)

```
[1] User clicks "Test now" in Dashboard component
       this.http.get<WhoAmIResponse>('/api/proxy/v1/whoami')

[2] correlationInterceptor       → mints X-Correlation-ID: abc-123
[3] tenantInterceptor            → attaches X-Tenant-ID: {current}
[4] securityInterceptor          → X-Requested-With + X-XSRF-TOKEN
[5] cacheInterceptor             → cache miss; proceeds
[6] dedupInterceptor             → no in-flight; proceeds
[7] loadingInterceptor           → loading++
[8] loggingInterceptor           → log "http.request"
[9] retryInterceptor             → no-op on request
[10] errorInterceptor            → no-op on request
[11] Browser ships HTTP request, includes ep.bff.session cookie automatically

[12] BFF middleware pipeline (see section 1 above):
     SecurityHeaders nonce → CorrelationId → ... → Authentication
     OnValidatePrincipal → TokenRefreshService:
       access_token expires_at − now > 5min → SKIP refresh
     [Authorize] passes
     AutoValidateAntiforgeryToken: GET = safe → skip CSRF check

[13] ProxyController.Forward("v1/whoami"):
     target = http://localhost:5044/api/v1/whoami
     copies request headers including X-Correlation-ID
     reads stashed access_token from ticket → Authorization: Bearer ...
     calls IHttpClientFactory("ep-proxy-api").GetAsync(target)

[14] Api host receives:
     GET http://localhost:5044/api/v1/whoami
     Authorization: Bearer eyJ...
     X-Correlation-ID: abc-123
     ── (Api middleware pipeline — see doc 05) ──
     WhoAmIEndpoint.Handle returns 200 + claim dump

[15] Response streams back:
     Api → BFF (LogHop fires with elapsed_ms)
     BFF → Browser (SecurityHeaders writes CSP etc.)

[16] Angular interceptors RESPONSE side (reverse order):
     errorInterceptor   → no error; passthrough
     retryInterceptor   → success; passthrough
     loggingInterceptor → log "http.response" with status 200, elapsed
     loadingInterceptor → loading--
     dedupInterceptor   → finalize() removes in-flight entry
     cacheInterceptor   → caches the response (5-min TTL)
     securityInterceptor → (no response action)
     tenantInterceptor  → (no response action)
     correlationInterceptor → (no response action)

[17] Dashboard component subscribe handler:
     state.set({ status: 'ok', response })
     Template renders green banner with claim dump
```

## 4. End-to-end trace — POST mutating request (e.g. create role)

Mostly identical to #3, with these additions:

- **Step 4 (securityInterceptor)** AND **Angular's withXsrfConfiguration**
  both attach `X-XSRF-TOKEN` (read from the readable XSRF-TOKEN cookie set
  by `AntiForgeryController.GetToken` at session start)
- **BFF Step 13** — `[AutoValidateAntiforgeryToken]` validates the
  `X-XSRF-TOKEN` header against the HttpOnly `__RequestVerificationToken`
  cookie. Mismatch → 400 BadRequest.
- **Api Endpoint Filter** — `ValidationEndpointFilter<TRequest>` runs
  FluentValidation against the request body. Failures → 400
  ProblemDetailsExtended with field errors.
- **Api Pipeline Behaviors** — `TransactionBehavior` opens an EF UoW
  transaction; `AuditBehavior` writes a row to `AuditLogs` (currently
  no-op via `NullAuditWriter` — see Compliance-TODO).

## 5. Antiforgery token bootstrap

The SPA must obtain an XSRF token ONCE per session, before any mutating
request. Today the SPA does this lazily on first need; the canonical spot is
in `AuthService.refreshSession()` after a successful sign-in:

```typescript
// Pseudocode — currently implicit via Angular's auto-XSRF behavior
const tokenResponse = await this.http.get('/api/antiforgery/token').toPromise();
// Server set XSRF-TOKEN cookie (readable) + __RequestVerificationToken (HttpOnly)
// Subsequent mutating XHRs auto-attach X-XSRF-TOKEN via withXsrfConfiguration
```

`AntiForgeryController.GetToken`:
```csharp
[HttpGet("token")]
public IActionResult GetToken()
{
    var tokens = _antiforgery.GetAndStoreTokens(HttpContext);
    Response.Cookies.Append("XSRF-TOKEN", tokens.RequestToken ?? "",
        new CookieOptions {
            HttpOnly = false,   // SPA needs to read it
            Secure = HttpContext.Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = "/",
        });
    return Ok(new { headerName = tokens.HeaderName });
}
```

## 6. SPA auth state propagation

```
provideAppInitializer (in app.config.ts)
    ↓
AuthService.refreshSession()
    ↓
GET /api/auth/session
    ↓
SessionInfo { isAuthenticated, name, email, roles, expiresAt }
    ↓
Signal updates: _session.set(...)
    ↓
isAuthenticated computed flips
    ↓
[effect] triggerHydrationOnLogin runs:
    AuthStore.hydrate()      → GET /api/auth/me/permissions
    SessionMonitor.start()   → poll /api/auth/session every 30s
                               (drives session-expiring dialog)
```

## 7. Auth flow (login click)

```
[Browser] Click "Sign in"
[SPA]     LoginComponent.signIn() → AuthService.login(returnUrl, 'select_account')
[SPA]     window.location.href = '/api/auth/login?returnUrl=...&prompt=select_account'

[BFF]     AuthController.Login validates returnUrl + prompt;
          Challenge(OidcScheme) issues 302 to Entra authorize URL

[Browser] follows 302 → login.microsoftonline.com → user signs in →
          POST /signin-oidc with { code, state }

[BFF]     OpenIdConnectHandler exchanges code for tokens (PKCE),
          SaveTokens=true → stash access/refresh/id in ticket;
          Cookie scheme writes ep.bff.session;
          OnSigningIn → SessionMetrics.SessionsCreated++ + stash session_started_at;
          302 redirect to /dashboard (from state)

[Browser] GET /dashboard → BFF SpaFallback serves Angular index.html
[SPA]     boots; refreshSession() → GET /api/auth/session → 200 with claims
[SPA]     authGuard sees isAuthenticated → renders dashboard
```

(Full sequence diagrams in `Docs/Architecture/BFF-Session-Flow.md`.)

## 8. Logout flow (Sign out click)

```
[SPA]     AuthService.logout(returnUrl)
            • Local signals cleared (_session.set(null), AuthStore.reset())
            • BroadcastChannel('ep:auth').postMessage('logout') → other tabs clear
            • Hidden <form method="POST" action="/api/auth/logout"> auto-submits

[BFF]     AuthController.Logout:
            SignOut(CookieScheme, OidcScheme, AuthenticationProperties{RedirectUri})
            Cookie scheme:
              OnSigningOut → SessionMetrics.SessionLifetimeSeconds.Record(...)
              delete Set-Cookie: ep.bff.session=
            OIDC scheme:
              OnRedirectToIdentityProviderForSignOut → adds id_token_hint
              builds end-session URL with post_logout_redirect_uri

[Browser] follows 302 → login.microsoftonline.com/.../oauth2/v2.0/logout
          (Entra clears its session — no account picker thanks to id_token_hint)
[Browser] back to /signout-callback-oidc → OIDC handler redirects to RedirectUri ('/')
[Browser] GET '/' → SpaFallback serves index.html
[SPA]     refreshSession() → 401 → authGuard → /auth/login
```

---

**Next:** [`07-Authentication-And-Authorization.md`](07-Authentication-And-Authorization.md) —
deep dive on the OIDC flow, JWT validation policy scheme, refresh-token
rotation, Microsoft Graph token acquisition, and authorization policies.
