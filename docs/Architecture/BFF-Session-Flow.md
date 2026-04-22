# BFF session-flow architecture

> **Scope.** End-to-end sequence diagrams for every Phase-9 BFF flow:
> initial bootstrap, login, proxied API call, silent refresh-token rotation,
> session expiry, logout. Read with [`UI-Architecture.md` §3.1](UI-Architecture.md)
> for the high-level picture and
> [`../Security/bff-oidc-setup.md`](../Security/bff-oidc-setup.md) for the
> Entra portal walkthrough.

## Topology

```
Browser (single origin: localhost:5001 in dev, https://app.{env} in prod)
   │
   │ HttpOnly + Secure + SameSite=Strict session cookie (ep.bff.session)
   ▼
BFF — Enterprise.Platform.Web.UI                         CORS NOT NEEDED
   ├─ /                                                  → SpaProxyMiddleware
   ├─ /api/auth/{login,logout,session,me/permissions}    → AuthController
   ├─ /api/antiforgery/token                             → AntiForgeryController
   ├─ /api/proxy/{**path}                                → BffProxyController
   │     ↑ session cookie only; NO Authorization header
   │     ↓ stashed access_token attached server-side
   │   Api — Enterprise.Platform.Api  (server-to-server)
   │     ↑ Authorization: Bearer <stashed token>
   │     ↑ X-Correlation-ID forwarded from BFF
   │     ↓ JSON response
   ├─ /signin-oidc, /signout-callback-oidc               → OpenIdConnectHandler
   ├─ /health/{live,ready}                               → HealthChecks
   └─ Angular dev server (:4200, internal — not browser-visible)
```

## 1. Initial bootstrap (cold load)

```
Browser                    BFF                          Entra
  │                         │
  │  GET /                  │
  │────────────────────────▶│
  │                         │ 200 index.html (proxied from :4200 in dev,
  │                         │     served from wwwroot in prod)
  │ ◀───────────────────────│
  │                         │
  │  Angular boots          │
  │  provideAppInitializer ─┐
  │                         │
  │  GET /api/auth/session  │
  │────────────────────────▶│
  │                         │ Cookie scheme reads ep.bff.session
  │                         │ — none present →  HttpContext.User anonymous
  │                         │
  │ ◀───────────────────────│ 200 {"isAuthenticated":false,...}
  │                         │
  │  authGuard sees isAuthenticated=false
  │  Router → /auth/login
  │  LoginComponent renders "Sign in" button
```

## 2. Login flow (top-level navigation, NOT XHR)

```
Browser                    BFF                          Entra
  │                         │
  │  click "Sign in"        │
  │  AuthService.login('/dashboard')
  │  window.location.href = '/api/auth/login?returnUrl=%2Fdashboard'
  │                         │
  │  GET /api/auth/login    │
  │────────────────────────▶│
  │                         │ AuthController.Login
  │                         │ • validate returnUrl via Url.IsLocalUrl
  │                         │ • Challenge(OidcScheme, AuthenticationProperties{RedirectUri='/dashboard'})
  │                         │ OpenIdConnectHandler builds authorize URL
  │                         │ + signs `state` carrying our RedirectUri
  │ ◀───────────────────────│ 302 Location: login.microsoftonline.com/.../authorize
  │                         │     ?client_id=<bff-id>
  │                         │     &redirect_uri=http://localhost:5001/signin-oidc
  │                         │     &response_type=code
  │                         │     &code_challenge=…  (PKCE)
  │                         │     &scope=openid+profile+offline_access+api://<api>/access_as_user
  │                         │     &state=<signed payload incl. /dashboard>
  │                         │
  │  follows 302 ──────────────────────────────────────▶│
  │                         │                          │ user signs in
  │                         │                          │ + consents (first run)
  │                         │                          │
  │  POST /signin-oidc ◀─────────────────────────────│ 302 form_post
  │  { code, state }        │                          │
  │────────────────────────▶│                          │
  │                         │ OpenIdConnectHandler:
  │                         │   • exchanges code → tokens (PKCE verifier match)
  │                         │   • verifies id_token signature
  │                         │   • SaveTokens=true → stash access/refresh/id in ticket
  │                         │ Cookie scheme:
  │                         │   • SignIn → OnSigningIn fires:
  │                         │     - SessionsCreated counter +1
  │                         │     - stash session_started_at on ticket
  │                         │   • write Set-Cookie: ep.bff.session=…
  │                         │ Redirect to /dashboard (from state)
  │ ◀───────────────────────│ 302 Location: /dashboard + Set-Cookie
  │                         │
  │  GET /dashboard         │
  │────────────────────────▶│ SpaProxyMiddleware → Angular index.html
  │                         │
  │  Angular boots fresh    │
  │  provideAppInitializer → AuthService.refreshSession()
  │  GET /api/auth/session  │
  │────────────────────────▶│ Cookie validates; isAuthenticated=true
  │ ◀───────────────────────│ 200 {"isAuthenticated":true,"name":"Hari","email":"…","roles":[],"expiresAt":"2026-04-23T02:21Z"}
  │                         │
  │  authGuard pass; Dashboard renders
```

## 3. Proxied Api call (`Test now` button)

```
Browser                    BFF                          Api
  │                         │
  │  GET /api/proxy/v1/whoami
  │  Cookie: ep.bff.session=…
  │  X-Correlation-ID: abc-123 (set by Angular's correlationInterceptor)
  │────────────────────────▶│
  │                         │ Cookie scheme validates ticket
  │                         │ → fires OnValidatePrincipal
  │                         │   → BffTokenRefreshService.ValidateAsync
  │                         │     • access_token expires_at > now+5min → SKIP refresh
  │                         │ [Authorize] passes
  │                         │ AutoValidateAntiforgeryToken: GET = safe → skip
  │                         │ BffProxyController.Forward:
  │                         │   • build target = http://localhost:5044/api/v1/whoami
  │                         │   • copy headers (incl. X-Correlation-ID)
  │                         │   • read access_token from ticket (GetTokenAsync)
  │                         │   • attach Authorization: Bearer …
  │                         │
  │                         │  GET /api/v1/whoami         │
  │                         │  Authorization: Bearer …    │
  │                         │  X-Correlation-ID: abc-123  │
  │                         │────────────────────────────▶│
  │                         │                             │ JwtBearer validates:
  │                         │                             │   • signature
  │                         │                             │   • aud ∈ AzureAd.Audiences
  │                         │                             │   • iss ∈ AzureAd.AllowedIssuers
  │                         │                             │   • scp ⊇ access_as_user
  │                         │                             │ Counter ep.api.token.audience_matched +1
  │                         │                             │   tag=api_prefixed (or implicit_clientid)
  │                         │                             │ Endpoint executes
  │                         │ ◀────────────────────────│ 200 { isAuthenticated, name, claims }
  │                         │
  │                         │ BffProxyController copies status + headers + body
  │                         │ LogHop emit (info; method, path, status, ms, sub)
  │ ◀───────────────────────│ 200 application/json
  │                         │
  │  SPA renders green banner "Authenticated — 27 claims"
```

## 4. Silent refresh-token rotation

```
Browser                    BFF                          Entra
  │                         │
  │  Periodic SessionMonitor poll OR any /api/proxy call
  │  GET /api/auth/session  │
  │────────────────────────▶│
  │                         │ Cookie scheme validates ticket
  │                         │ → OnValidatePrincipal → BffTokenRefreshService:
  │                         │   • access_token expires_at - now < 5min → REFRESH
  │                         │
  │                         │  POST oauth2/v2.0/token     │
  │                         │  grant_type=refresh_token   │
  │                         │  client_id, client_secret   │
  │                         │  refresh_token=…            │
  │                         │  scope=openid profile offline_access api://…/access_as_user
  │                         │────────────────────────────▶│
  │                         │ ◀────────────────────────│ 200 { access_token, refresh_token (rotated), expires_in }
  │                         │
  │                         │ Properties.StoreTokens([new access, new refresh, new expires_at])
  │                         │ context.ShouldRenew = true → cookie scheme re-issues Set-Cookie
  │                         │ Counter ep.bff.session.refreshed +1
  │                         │
  │                         │ AuthController.Session executes
  │ ◀───────────────────────│ 200 { ... expiresAt: <new value> } + new Set-Cookie
  │                         │
  │  SessionMonitor records new expiresAt; warning timer reset
```

If the refresh fails (network, refresh token expired, client secret rotated
without our user-secrets being updated, etc.) `RejectPrincipal()` is called
+ counter `ep.bff.session.refresh_failed{reason}` ticks. The cookie is
scheduled for deletion; the next request returns 401 → SPA's
`errorInterceptor` redirects to `/auth/login`.

## 5. Session expiry (no refresh available)

```
Browser                    BFF
  │                         │
  │  XHR in long-idle tab   │
  │  Cookie: ep.bff.session=… (cookie still present client-side)
  │────────────────────────▶│
  │                         │ Cookie scheme validates ticket:
  │                         │   ExpiresUtc < now → ticket expired
  │                         │ Principal becomes anonymous
  │                         │ [Authorize] fails → DefaultChallengeScheme=OIDC
  │                         │ OnRedirectToLogin event: 401 (per BffAuthenticationSetup)
  │ ◀───────────────────────│ 401
  │                         │
  │  errorInterceptor sees 401:
  │    sticky toast "Session expired"
  │    Router → /auth/login
```

## 6. Logout (top-level POST → Entra single sign-out)

```
Browser                    BFF                          Entra
  │                         │
  │  AuthService.logout('/')
  │  • clear local signals (no flash of stale UI)
  │  • BroadcastChannel('ep:auth').postMessage('logout')   (other tabs clear too)
  │  • build hidden <form method="POST" action="/api/auth/logout?returnUrl=/">
  │  • form.submit() → top-level navigation
  │                         │
  │  POST /api/auth/logout  │
  │────────────────────────▶│
  │                         │ AuthController.Logout:
  │                         │   SignOut(CookieScheme, OidcScheme, RedirectUri='/')
  │                         │ Cookie scheme:
  │                         │   OnSigningOut → SessionLifetimeSeconds.Record(now - session_started_at)
  │                         │   delete Set-Cookie: ep.bff.session=
  │                         │ OIDC scheme builds end-session URL
  │ ◀───────────────────────│ 302 Location: login.microsoftonline.com/.../oauth2/v2.0/logout
  │                         │     ?post_logout_redirect_uri=http://localhost:5001/signout-callback-oidc
  │
  │  follows 302 ──────────────────────────────────────▶│
  │                         │                          │ Entra clears session
  │  GET /signout-callback-oidc ◀─────────────────────│ 302
  │────────────────────────▶│
  │                         │ OpenIdConnectHandler completes sign-out
  │                         │ Redirect to RedirectUri ('/')
  │ ◀───────────────────────│ 302 Location: /
  │
  │  GET /                  │
  │────────────────────────▶│ SpaProxyMiddleware → index.html
  │  authGuard kicks in: not authenticated → /auth/login
```

## Cross-cutting: correlation IDs

Every browser-originated request carries (or is assigned) a single
`X-Correlation-ID`:

1. The Angular `correlationInterceptor` mints / echoes one on every XHR.
2. The BFF's correlation middleware echoes it on the response and attaches
   it to the Serilog `LogContext`.
3. `BffProxyController` explicitly copies it onto the outbound request to the Api.
4. The Api's correlation middleware sees it, echoes it on its own logs.

A single id is therefore searchable across the SPA's structured logs (App
Insights), the BFF's logs, and the Api's logs — diagnostics for any failed
flow above can be reconstructed end-to-end with one query.

## Cross-cutting: metrics

Phase 9.F.2 emits via `System.Diagnostics.Metrics`:

| Metric | Source | Tags | Use |
|---|---|---|---|
| `ep.bff.session.created` (counter) | OnSigningIn | — | Login throughput |
| `ep.bff.session.refreshed` (counter) | BffTokenRefreshService.ValidateAsync | — | Refresh-rotation health |
| `ep.bff.session.refresh_failed` (counter) | BffTokenRefreshService.ValidateAsync | `reason` (missing_tokens, network, http_4xx, deserialize, empty_payload) | Detect Entra misconfig + secret rotation |
| `ep.bff.session.lifetime` (histogram, seconds) | OnSigningOut | `reason` (signout) | Distribution of session durations |
| `ep.api.token.audience_matched` (counter) | Api `OnTokenValidated` (Phase 9.C.1) | `audience_kind` (api_prefixed, implicit_clientid, other, missing) | Drives Phase 9.C.3 hardening decision |

All available under the meter names `Enterprise.Platform.Web.UI` (BFF) and
`Enterprise.Platform.Api` (Api); pick them up via OpenTelemetry exporter
already wired by `ObservabilitySettings`.
