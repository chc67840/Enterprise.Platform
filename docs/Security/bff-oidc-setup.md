# BFF OIDC setup — Phase 9 A1 / B1-B2

> **Scope.** Everything needed to turn the BFF's OIDC flow from dormant to
> live: a new confidential-client Entra App Registration, a client secret in
> local user-secrets, and `AzureAd.Enabled = true` in `appsettings.Development.json`.
>
> **Prerequisite.** Phase 7.6 SPA→Api direct flow is working. The existing
> SPA App Registration (`a703a89e-19ba-4ffb-bdfc-aa65b72833f4`) stays
> untouched — we provision a **separate** BFF registration so rollback is
> trivial and the SPA direct path continues to work behind the feature flag
> until cutover (G1).

---

## Why a second App Registration (A1)

The existing `a703a89e-…` registration has platform type **Single-page application**. Flipping it to **Web** (which the confidential-client flow requires) would:

1. Break the SPA direct path immediately — MSAL can't use a Web-platform registration.
2. Require a client secret against a registration that wasn't designed to hold one.
3. Lose rollback — no way back to the direct-SPA path without re-registering the platform.

Provisioning a **second** registration keeps both paths alive during the migration window. The SPA registration stays as-is; the BFF registration handles the confidential-client OIDC flow. Once the BFF is proven in prod, the SPA registration can be retired.

---

## Step-by-step portal checklist

### 1. Create the BFF App Registration

1. Portal → **Microsoft Entra ID** → **App registrations** → **+ New registration**.
2. Name: `Enterprise.Platform.Web.UI (BFF) — Dev` (repeat per environment with `— Staging`, `— Prod` suffixes).
3. Supported account types: **Accounts in this organizational directory only** (single tenant). Match the Api's tenant.
4. Redirect URI: leave blank here — we configure it under **Authentication** in a moment.
5. **Register**.
6. Copy the **Application (client) ID** shown on the overview. You'll paste it into `appsettings.Development.json` → `AzureAd.ClientId`.

### 2. Authentication platform → Web

1. Left nav → **Authentication** → **+ Add a platform** → **Web**.
2. Redirect URIs — add **both** of these:
   - `http://localhost:5001/signin-oidc`  (dev — Entra allows HTTP for localhost loopback)
   - `http://localhost:5001/signout-callback-oidc`  (dev — the middleware's `SignedOutCallbackPath` is a redirect URI, not a front-channel URL)
3. Per-environment additions when staging/prod come up:
   - `https://your-staging-bff/signin-oidc` + `https://your-staging-bff/signout-callback-oidc`
   - `https://your-prod-bff/signin-oidc` + `https://your-prod-bff/signout-callback-oidc`
4. Front-channel logout URL: **leave blank**. That field is HTTPS-only (even for localhost, where Entra rejects HTTP with *"The logout URL must start with HTTPS"*) and is only used for *third-party-initiated* sign-out notifications — NOT for our server-initiated logout. Our flow completes entirely via the `signout-callback-oidc` redirect URI.
5. Implicit grant: **leave both unchecked** (we use authorization code, not implicit).
6. **Save**.

### 3. Create a client secret

1. Left nav → **Certificates & secrets** → **+ New client secret**.
2. Description: `bff-dev-secret-2026Q2` (date-stamp so rotation is obvious).
3. Expiry: **6 months** in dev, **12 months** staging/prod (shorter than Entra's 24-month max — forces rotation hygiene).
4. **Add**.
5. **Copy the `Value` field immediately** (not the `Secret ID`). You will never see this value again — closing the blade invalidates it.
6. Stash it in dev-machine user-secrets (step 6 below).

### 4. API permissions — the outbound scope the BFF will acquire

1. Left nav → **API permissions** → **+ Add a permission** → **My APIs** tab.
2. Select the **existing SPA App Registration** (`Enterprise.Platform.Api` / `a703a89e-…` — whichever exposes `access_as_user`).
3. **Delegated permissions** → check `access_as_user` → **Add permissions**.
4. Click **Grant admin consent for \<tenant\>** → **Yes**.
5. Also add standard OIDC scopes:
   - **Microsoft Graph** → **Delegated** → `openid`, `profile`, `offline_access`, `User.Read` → Add → Grant admin consent.

`offline_access` is what unlocks `refresh_token` issuance. Without it, B7's silent renewal is impossible.

### 5. Token configuration (optional but recommended)

1. Left nav → **Token configuration** → **+ Add optional claim** → **ID** token → check `tid`, `email`, `upn` → **Add**.
2. Repeat for **Access** token with `tid`.

These reach the BFF's cookie ticket without an extra Graph round-trip.

### 6. Stash the client secret in user-secrets

From the repo root:

```bash
cd src/UI/Enterprise.Platform.Web.UI
dotnet user-secrets init
dotnet user-secrets set "AzureAd:ClientSecret" "<the Value you copied in step 3>"
dotnet user-secrets list   # sanity check — secret appears
```

user-secrets are stored in `%APPDATA%\Microsoft\UserSecrets\<UserSecretsId>\secrets.json` and are picked up automatically in `Development` by `WebApplication.CreateBuilder`. They never reach disk inside the repo.

### 7. Flip the enable switch

Edit `src/UI/Enterprise.Platform.Web.UI/appsettings.Development.json`:

```jsonc
"AzureAd": {
  "Enabled": true,   // ← flip from false
  "TenantId": "f404bba4-4ff2-4d0b-a967-484b87662ab0",
  "ClientId": "<the client id from step 1>",   // ← paste
  "ApiScope": "api://a703a89e-19ba-4ffb-bdfc-aa65b72833f4/access_as_user"
  // … CallbackPath + SignedOutCallbackPath keep defaults
}
```

Restart the BFF (`F5` in VS 2026 or `dotnet run --project src/UI/Enterprise.Platform.Web.UI`). Startup log should include:

```
info: Microsoft.AspNetCore.Authentication.OpenIdConnect[*]
      … Authority = https://login.microsoftonline.com/f404bba4-.../v2.0
```

If startup instead throws `InvalidOperationException: BFF OIDC is enabled but required AzureAd configuration is missing`, the loud validator caught a gap — fix the listed field(s) and retry.

### 8. Smoke test the authority document

Before hitting the BFF from the SPA, sanity-check that Entra actually advertises the tenant:

```bash
curl -s https://login.microsoftonline.com/f404bba4-4ff2-4d0b-a967-484b87662ab0/v2.0/.well-known/openid-configuration \
  | head -c 300
```

Expected response is a JSON blob starting with `{"token_endpoint":"https://login.microsoftonline.com/f404bba4-…/oauth2/v2.0/token"`. A 404 here means the tenant id is wrong.

---

## What's NOT covered by this runbook (deferred to later B-tasks)

| Deferred to | What |
|---|---|
| B3 | `AuthController` endpoints (`/api/auth/login`, `/logout`, `/session`) that actually trigger the OIDC challenge |
| B5 | Setting `Bff:Proxy:AttachBearerToken = true` (already flipped in `appsettings.Development.json`) |
| B7 | `OnValidatePrincipal` silent refresh-token rotation |
| B10 | Header-delivered CSP with per-request nonce |
| D1-D10 | Stripping MSAL from the SPA and pointing it at the BFF |

Completing A1 + B1 + B2 gets the OIDC plumbing to "compiled and loadable" — but the BFF still has no endpoint that issues a `Challenge(OidcScheme)`, so clicking login in the SPA doesn't trigger the new flow yet. That's B3.

---

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Startup throws `BFF OIDC is enabled but required AzureAd configuration is missing` | Step 6 skipped (no user-secret) or step 7 used the wrong field name | Re-run `dotnet user-secrets set "AzureAd:ClientSecret" <value>` inside the Web.UI project dir |
| Browser gets `AADSTS50011: The redirect URI ... specified in the request does not match` | Step 2 redirect URI typo | Copy the URL Entra shows in the error message (query-string decoded) and paste it verbatim into the App Registration's redirect URI list |
| `IDX20803: Unable to obtain configuration from 'https://login.microsoftonline.com/.../v2.0/.well-known/...'` | TenantId wrong, or `RequireHttpsMetadata = true` against an HTTP non-loopback hostname | Confirm tenant id via step 8 curl; for non-loopback dev hostnames set up an HTTPS dev cert |
| Browser returns to `/signin-oidc` but sees a plain 401 instead of a session cookie | Client secret wrong or expired | Generate a fresh secret (step 3), update user-secrets (step 6), restart BFF |
| Startup log shows `The 'aud' was not valid` after callback | Access token's audience doesn't match Api's `AzureAd.Audiences` | Verify `ApiScope` in `appsettings.Development.json` matches one of the Api's `Audiences` entries (or its `api://`-prefixed form) |

---

## Rotation + retirement

- Client secret: rotate on the 6-month / 12-month schedule set in step 3. Never let it expire unnoticed — set a calendar reminder 30 days out.
- When the SPA direct-MSAL path is retired (post-G2), the old SPA App Registration can be deleted. The BFF registration then becomes the single source of truth for Entra integration.
