# Auth smoke test — SPA → BFF → Entra → Api round trip

> **Scope.** Confirms the Phase-9 BFF cookie-session wiring works end-to-end
> against a real Azure Entra tenant. The browser navigates to the BFF, the
> BFF runs the OIDC code+PKCE dance against Entra, a session cookie is set,
> and `GET /api/proxy/v1/whoami` returns the Api's claim dump.
>
> **When to run.**
> 1. After rotating either App Registration's values (BFF or Api).
> 2. After changing `public/config.json`, the BFF's `appsettings.*.json`
>    (especially `AzureAd` / `Bff:Proxy`), or the Api's `EntraId` section.
> 3. When auth-related code lands on a PR.
>
> **The MSAL-direct path (Phase 7.6) is RETIRED.** This runbook reflects the
> Phase-9 cookie-session topology. Sections 1–5 below cover the live BFF
> flow; the legacy MSAL section (numbered 6+) is kept for archival reference
> only and SHOULD NOT be used for new smoke tests.

## 0. Topology at a glance (as of 2026-04-22)

```
Browser (localhost:5001)
   │
   │ session cookie (HttpOnly, Secure, SameSite=Strict)
   ▼
BFF — Enterprise.Platform.Web.UI on :5001
   ├─ /api/auth/{login,logout,session}    → AuthController
   ├─ /api/auth/me/permissions            → AuthController (placeholder until D4)
   ├─ /api/antiforgery/token              → AntiForgeryController
   ├─ /api/proxy/{**path}                 → BffProxyController
   │     │ stashed bearer token (server-side)
   │     ▼
   │   Api — Enterprise.Platform.Api on :5044
   │     │ JWT validation (audience, issuer, scope)
   │     ▼
   │   /api/v1/whoami → 200 + claim dump
   ├─ /signin-oidc, /signout-callback-oidc → OpenIdConnectHandler
   ├─ /health/{live,ready}                → BFF health endpoints
   └─ (anything else)                     → SpaProxyMiddleware → Angular dev server (:4200)
```

---

## A. BFF cookie-flow smoke (current path)

### A.1 Pre-flight

| Service | How to start | Expected URL |
|---|---|---|
| Api (.NET) | VS 2026 F5 → `Enterprise.Platform.Api` | `http://localhost:5044` |
| Angular dev server | `npm --prefix src/UI/Enterprise.Platform.Web.UI/ClientApp start` | `http://localhost:4200` (internal — never visit directly) |
| BFF (.NET) | VS 2026 F5 → `Enterprise.Platform.Web.UI` (http profile) | `http://localhost:5001` |

Sanity check all three:

```bash
curl -s http://localhost:5044/health/live | head -c 200    # Api alive
curl -s http://localhost:5001/health/live | head -c 200    # BFF alive
curl -s http://localhost:5001/health/ready | head -c 400   # BFF + Api reachable
curl -s http://localhost:4200/ | head -c 100               # Angular dev server alive
```

### A.2 The test

1. Open `http://localhost:5001/` in an incognito window.
2. App router redirects to `/auth/login` → click **Sign in with Microsoft**.
3. SPA fires a top-level navigation to `/api/auth/login?returnUrl=/dashboard`.
4. BFF responds 302 to Entra's authorize endpoint (PKCE-protected).
5. Sign in with a tenant user; consent if first run.
6. Entra POSTs to `http://localhost:5001/signin-oidc`. The OIDC middleware
   exchanges code → tokens, stashes them in the cookie ticket, sets the
   `ep.bff.session` cookie, redirects to `/dashboard`.
7. Dashboard renders. The header shows your name; **Roles** and **Permissions**
   cards may be empty (D4-deferred placeholder until PlatformDb).
8. Click **Test now** on the "Verify backend connectivity" card.
9. ✓ Expected — green banner with claim dump:
   ```
   ✓ Authenticated — Api returned ~27 claims
   { aud: 'api://a703a89e-…', iss: 'https://sts.windows.net/f404bba4-…/', scp: 'access_as_user', name: '…', … }
   ```

### A.3 What to inspect in DevTools

Open Network tab, filter to XHR. Find the `whoami` call:

- **Request URL:** `http://localhost:5001/api/proxy/v1/whoami` (same-origin, no CORS preflight)
- **Request headers:**
  - `Cookie: ep.bff.session=…` — the BFF session cookie (HttpOnly so JS can't read it; the browser ships it automatically)
  - `X-Correlation-ID: <uuid>` — minted by the BFF's correlation middleware
  - **No `Authorization` header** — by design; the bearer is server-side only
- **Response:** 200 OK, JSON body with the Api's claim dump

Find the corresponding Api log line — it should carry the same `X-Correlation-ID` value (forwarded by `BffProxyController` per Phase 9.B.8).

### A.4 Common failure modes

| Symptom | Diagnosis | Fix |
|---|---|---|
| Browser stuck on `localhost:5001/dashboard` with no claims | Initial `GET /api/auth/session` failed before bootstrap. Check `auth.session.load.failed` log line | Confirm BFF is up and returning JSON for `/api/auth/session` |
| Login redirect → Entra error `AADSTS50011: redirect URI mismatch` | A redirect URI registered with the BFF App Registration doesn't match what the OIDC handler is sending | Verify the App Registration has `http://localhost:5001/signin-oidc` AND `http://localhost:5001/signout-callback-oidc` under Redirect URIs |
| `Test now` returns 401 | BFF stashed token expired and refresh failed | Check BFF logs for `Token.Refresh.Failed` (event id 2005) — common cause: client secret rotated. Re-set via `dotnet user-secrets set "AzureAd:ClientSecret" <value>` |
| `Test now` returns 502 BadGateway | BFF reached the proxy logic but downstream Api unreachable | Confirm Api is running on :5044; check BFF `Bff.Proxy.Unreachable` log line for the exception type |
| `Test now` returns 500 with a long stack trace | Api validated the token but the endpoint itself errored | Check Api log for the actual exception. Common: `ToDictionary` on duplicate claim types — see [`feedback_entra_duplicate_claims`](../../C:/Users/hkgou/.claude/projects/...) memory |
| Mutating XHR (POST/PUT/PATCH/DELETE) returns 400 with anti-forgery error | SPA didn't echo `X-XSRF-TOKEN` header | Confirm SPA called `GET /api/antiforgery/token` once at session start; Angular's built-in `withXsrfConfiguration` should auto-attach the header on subsequent unsafe verbs |
| Multiple "rate limit exceeded" 429s in DevTools | Hot-loop or test harness exceeded the BFF edge limiter (120/sec/session, 600/sec/IP) | Confirmed expected behaviour; back off or temporarily raise `BffRateLimiterSetup` thresholds for the test |

### A.5 What this runbook DOESN'T prove

- **PlatformDb-backed permission hydration** — D4-deferred. The placeholder
  `/api/auth/me/permissions` returns empty fine-grained permissions until then.
- **Cookie / refresh-token rotation under sustained load** — the
  `OnValidatePrincipal` hook fires on each authenticated request; refresh
  rotation is observable as `Token.Refresh.Success` log lines (event id 2004)
  + `ep.bff.session.refreshed` counter ticks.
- **HTTPS-only cookie behaviour** — dev runs HTTP-loopback on `:5001`; the
  cookie's `SecurePolicy = SameAsRequest` lets it ride. Stage/prod enforce
  HTTPS-only via `SecurePolicy = Always`.

---

---

## B. Legacy MSAL direct-SPA flow — DEPRECATED (kept for archival reference only)

> ⚠️ **DO NOT use this section for new smoke tests.** Phase 9 retired the
> direct-SPA path. The MSAL config + factories were removed from the SPA;
> the @azure/msal-* packages are uninstalled. The Entra App Registration
> for direct-SPA (`a703a89e-…`) still exists for token-audience validation
> on the Api side, but the SPA cannot use it for sign-in anymore. This
> section documents the historical wiring for posterity.

## 1. Legacy direct-SPA wiring (Phase 7.6, retired 2026-04-21)

| Setting | SPA (`public/config.json` + `environment.ts`) | Api (`appsettings.Development.json`) |
|---|---|---|
| **Client ID** | `a703a89e-19ba-4ffb-bdfc-aa65b72833f4` | `AzureAd.ClientId` = same |
| **Tenant ID** | `f404bba4-4ff2-4d0b-a967-484b87662ab0` | `AzureAd.TenantId` = same |
| **API scope** | `api://a703a89e-.../access_as_user` | `AzureAd.RequiredScopes: ['access_as_user']` |
| **Audience(s) accepted** | — | `a703a89e-...` **and** `api://a703a89e-...` |
| **Allowed issuers** | — | `https://login.microsoftonline.com/{tid}/v2.0` + `https://sts.windows.net/{tid}/` (covers v1 + v2 tokens) |
| **Redirect URI** | `http://localhost:4200` | — |
| **API base URL (SPA)** | `http://localhost:5044/api/v1` | — |
| **CORS origin allowed by Api** | — | `http://localhost:4200` |

The "single-app-registration" pattern is used — the SPA and the Api surface
on the same Entra App Registration. If/when a separate Api registration is
stood up, flip:

- `public/config.json` + `environment.ts` → `msal.apiScope: 'api://{Api-clientId}/access_as_user'`
- `appsettings.Development.json` → `AzureAd.ClientId` = `{Api-clientId}`, add `{Api-clientId}` + `api://{Api-clientId}` to `Audiences`.

---

## 2. Azure portal checklist (one-time setup)

In the **App Registration** for client id `a703a89e-19ba-4ffb-bdfc-aa65b72833f4`:

1. **Authentication** →
   - Platform: **Single-page application**.
   - Redirect URIs: `http://localhost:4200` (exact match, no trailing slash).
   - Front-channel logout URL: `http://localhost:4200/auth/login` (optional).
   - Supported account types: **Accounts in this organizational directory only** (single tenant). If multi-tenant, `AzureAd.TenantId` in the Api must be `common` + `AllowedIssuers` must enumerate each trusted tenant.

2. **Expose an API** →
   - Application ID URI: `api://a703a89e-19ba-4ffb-bdfc-aa65b72833f4` (accept the default).
   - Add a scope:
     - Scope name: `access_as_user`.
     - Who can consent: **Admins and users**.
     - Admin consent display name: "Access platform API as the signed-in user".
     - State: **Enabled**.

3. **API permissions** (on the SAME app registration) →
   - Add a permission → **My APIs** → select this app → delegated → `access_as_user`.
   - Grant admin consent for the tenant.

4. **Token configuration** (optional but recommended) →
   - Add optional claim `tid` to the id token + access token (so the Api's
     tenant-mapping hook can read it without a graph call).

---

## 3. Local services

| Service | How to start | Expected URL |
|---|---|---|
| Api (.NET) | `dotnet run --project src/API/Enterprise.Platform.Api` | `http://localhost:5044` |
| SPA (Angular) | `npm --prefix src/UI/Enterprise.Platform.Web.UI/ClientApp start` | `http://localhost:4200` |

Sanity check the Api is up: `curl http://localhost:5044/health/live` → `200 Healthy`.

---

## 4. The test

1. Open `http://localhost:4200/` in an incognito window.
2. App redirects to `/auth/login` → click "Sign in".
3. Redirected to `login.microsoftonline.com/f404bba4-.../oauth2/v2.0/authorize?…`.
   Sign in with a user in the tenant.
4. If it's the first consent, accept the app permission.
5. Redirected back to `http://localhost:4200/auth/login?code=…`.
   MSAL exchanges the code for a token; the `provideAppInitializer` MSAL
   hook calls `setActiveAccount`. Routing continues → `/dashboard`.
6. Dashboard renders your name + 0 permissions (expected — `/me/permissions`
   is D4-deferred, see `00-Foundation-TODO.md`).
7. Click **"Test now"** on the "Verify backend connectivity" card.
8. ✓ Expected — green banner + claim dump (ordinarily 10–15 claims):
   ```
   ✓ Authenticated — Api returned 14 claims
   [expand] → { aud: 'api://a703a89e-…', iss: 'https://login.microsoftonline.com/f404bba4-…/v2.0', scp: 'access_as_user', … }
   ```

### What to inspect in DevTools

Open Network tab, find the `whoami` request:

- Request headers:
  - `Authorization: Bearer eyJ0eXAiOiJKV1QiLCJub25jZSI6…` — MSAL interceptor.
  - `X-Correlation-ID: <uuid>` — correlation interceptor (Phase 2.3).
  - `Accept: application/json, text/plain, …` — default.
- Response: 200, body is the `{ isAuthenticated, name, claimCount, claims }` envelope.

Paste the access token into <https://jwt.ms> to confirm:
- `aud` ∈ `{ a703a89e-…, api://a703a89e-… }`
- `iss` = `https://login.microsoftonline.com/f404bba4-…/v2.0` (or the v1 issuer for legacy tokens)
- `tid` = `f404bba4-…`
- `scp` includes `access_as_user`
- `exp` is ~60 min in the future

---

## 5. Common failure modes

| Symptom | Diagnosis | Fix |
|---|---|---|
| Azure login redirects to `http://localhost:4200/` but browser shows CORS / network error | Redirect URI mismatch | Add `http://localhost:4200` to the App Registration's SPA redirect URIs, *exact* match. |
| Dashboard loads but "Test now" returns 401 | Api rejects the token | Check Api logs — `AuthenticationHandler: token failed validation`. Usually audience or issuer mismatch. Compare `aud`/`iss` in the JWT (paste into jwt.ms) against `AzureAd.Audiences` + `AzureAd.AllowedIssuers`. |
| "Test now" returns 403 | Token validates but scope missing | Verify the SPA requested `api://{clientId}/access_as_user`; verify Api's `AzureAd.RequiredScopes` includes `access_as_user`. |
| "Test now" returns 0 + "Unable to reach the server" | CORS preflight failed OR Api not running | Check Api process is up; ensure `Cors.AllowedOrigins` includes `http://localhost:4200`; ensure all our custom headers are in `Cors.AllowedHeaders` (MSAL preflight will fail if `Authorization` is absent). |
| Dashboard hangs on load, console shows MSAL `interaction_in_progress` loop | `provideAppInitializer` not awaiting `handleRedirectPromise` | Verify `src/app/config/app.config.ts` runs MSAL init AFTER `loadRuntimeConfig`. |
| `/me/permissions` returns 404 in Network tab | Expected — D4-deferred until PlatformDb lands | Not a failure. The dashboard shows 0 permissions; `/whoami` still works because it reads the token claims directly. |

---

## 6. What this runbook DOESN'T prove

- PlatformDb-backed permission hydration (`/me/permissions`) — D4-deferred
  per `Docs/Implementation/00-Foundation-TODO.md`. When that endpoint ships,
  the dashboard's "Roles" + "Permissions" cards will populate.
- Tenant-mapping — `MultiTenancy.RequireResolvedTenant = false` in dev;
  enable + populate `PlatformTenantMapping` when multi-tenant routing is
  exercised.
- Refresh-token flow — MSAL handles silent refresh internally; Phase 2.4's
  `SessionMonitorService` provides the UX for pre-expiry warnings.
