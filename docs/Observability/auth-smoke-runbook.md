# Auth smoke test — SPA → Entra → Api round trip

> **Scope.** Confirms the Phase-7 MSAL wiring works end-to-end against a
> real Azure Entra tenant: SPA redirects to Entra, user authenticates,
> SPA receives token, Api validates token, `/api/v1/whoami` returns claim set.
>
> **When to run.**
> 1. After rotating Azure App Registration values.
> 2. After changing `public/config.json` or the Api's `AzureAd` /
>    `Cors` sections.
> 3. When auth-related changes land on a PR.

---

## 1. Current wiring (as of 2026-04-21)

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
