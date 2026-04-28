# 11 — Reuse an existing App Registration (single-registration model)

> **When this doc applies.** You are recreating Enterprise.Platform on a new
> tenant / account where you **cannot create new App Registrations**, but you
> have **Owner** rights on one existing registration (called `Test-Dev` in this
> doc). The same registration will serve as **both** the BFF's OIDC client and
> the API's JWT resource.
>
> **Differs from the original setup how?** The canonical recipe in
> [`07-Authentication-And-Authorization.md`](07-Authentication-And-Authorization.md)
> + [`Docs/Security/bff-oidc-setup.md`](../Security/bff-oidc-setup.md) uses
> **two** registrations (one SPA-platform exposing the API scope, one Web-platform
> for the BFF). This doc collapses both roles into one registration. Auth flows
> are identical at runtime; only the IDs in `appsettings` change.

---

## 0. Mental model — one registration, two roles

```
┌──────────────────────────── Test-Dev (one App Registration) ────────────────────────────┐
│                                                                                          │
│  ROLE 1 — OIDC client (consumed by BFF):                                                 │
│    • Platform: Web                                                                       │
│    • Redirect URIs: http://localhost:5001/signin-oidc, .../signout-callback-oidc         │
│    • Client secret (used by BFF to redeem the auth code)                                 │
│    • API permissions → Microsoft Graph: openid, profile, offline_access, User.Read       │
│    • API permissions → My APIs → Test-Dev → access_as_user  ← the single-reg trick       │
│                                                                                          │
│  ROLE 2 — API resource (validated by API):                                               │
│    • Application ID URI:  api://<test-dev-client-id>                                     │
│    • Exposed scope:       access_as_user                                                 │
│    • App roles:           Administrator (existing) + Platform.User (add)                 │
│    • Manifest:            accessTokenAcceptedVersion = 2                                 │
│                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘

       BFF (port 5001)                                       API (port 5044)
       ─────────────                                         ─────────────
   AzureAd.ClientId       = <test-dev-client-id>          AzureAd.ClientId    = <test-dev-client-id>
   AzureAd.TenantId       = <new-tenant-id>               AzureAd.TenantId    = <new-tenant-id>
   AzureAd.ClientSecret   = <new secret value>            (no secret — API only validates JWTs)
   AzureAd.ApiScope       = api://<client-id>/access_as_user
                                                          AzureAd.Audience    = <test-dev-client-id>
                                                          (or "api://<client-id>" if v1 tokens)
```

**Trade-offs vs two-registration model.** Less role separation; the BFF can
in theory ask Entra for a token to "itself" by name. In dev that's fine. For
prod, request a second registration so blast radius is bounded.

---

## 1. Information you'll collect (fill in as you go)

| Item | Where to find it | Your value |
|---|---|---|
| Tenant ID | Test-Dev → Overview → "Directory (tenant) ID" | |
| Client ID | Test-Dev → Overview → "Application (client) ID" | |
| Application ID URI | Test-Dev → Expose an API → top of page | `api://<client-id>` |
| API scope (full) | Built from the URI + scope name | `api://<client-id>/access_as_user` |
| Client secret VALUE | Certificates & secrets → newly created → copy at creation only | (paste into user-secrets, never the repo) |
| Token version | Manifest → `accessTokenAcceptedVersion` | `2` (recommended) |

> **Pro tip.** Open Notepad. Paste each value as you collect it. The secret
> VALUE in particular is **only visible once at creation** — Azure stores
> only its hash thereafter.

---

## 2. Pre-flight — protect existing config

Test-Dev belongs to another app. Before any change, **screenshot or copy**
these blades (so you can restore if anything goes sideways):

1. **Overview** — note existing display name, owners.
2. **Authentication** — list every existing Redirect URI, Front-channel logout URL, implicit-grant flags.
3. **Certificates & secrets** — note descriptions + expiries (NOT values — you can't see them).
4. **API permissions** — list every existing permission, who consented.
5. **Expose an API** — note Application ID URI + every existing scope.
6. **App roles** — note every existing role (id, value, display name, allowed member types).

> Rule: **add, don't replace**. Multiple Redirect URIs, secrets, scopes,
> and roles can coexist without conflict.

---

## 3. Step-by-step portal walkthrough

### 3.1 Get Tenant ID + Client ID

1. Portal → **Microsoft Entra ID** → **App registrations** → **All applications** → **Test-Dev**.
2. **Overview** blade.
3. Copy:
   - **Directory (tenant) ID** → put it in the table above as `TenantId`.
   - **Application (client) ID** → put it in the table above as `ClientId`.

### 3.2 Add Redirect URIs (Authentication blade)

1. Left nav → **Authentication**.
2. Under **Web** platform (if no Web platform exists yet → **+ Add a platform** → **Web**):
3. **+ Add URI** twice. Add **both**:
   - `http://localhost:5001/signin-oidc`
   - `http://localhost:5001/signout-callback-oidc`
4. Leave existing URIs untouched.
5. **Front-channel logout URL** — leave whatever's there alone. Do **not** put any signout URL there. Entra rejects HTTP for that field, and our middleware uses the `signout-callback-oidc` redirect URI for sign-out completion (not front-channel).
6. **Implicit grant** — leave both checkboxes **unchecked** (we use Authorization Code + PKCE).
7. **Save**.

> **Why HTTP is OK here.** Entra makes one exception to its HTTPS rule —
> `localhost` loopback addresses for the Redirect URIs list. (See memory:
> `feedback_entra_redirect_uri_gotchas`.)

### 3.3 Generate a NEW client secret

You **cannot reuse** the existing two secrets — Azure shows the secret VALUE
only at creation; thereafter only the hint+expiry. Multiple secrets coexist
without conflict, so add a new one.

1. Left nav → **Certificates & secrets** → **Client secrets** tab → **+ New client secret**.
2. Description: `enterprise-platform-bff-dev-2026Q2` (date-stamp = rotation hygiene).
3. Expiry: **6 months** for dev (24-month max — shorter forces rotation).
4. **Add**.
5. **IMMEDIATELY copy the `Value` column** (not `Secret ID`). The blade redacts it the moment you navigate away.
6. Paste into a temporary plaintext note — you'll move it to user-secrets in step 4.2.

### 3.4 Expose the API + add `access_as_user` scope

1. Left nav → **Expose an API**.
2. **Application ID URI** field (top of page):
   - If blank → click **Add** → accept the default `api://<client-id>` → **Save**.
   - If already set → leave it. Note the value.
3. **Scopes defined by this API** section → **+ Add a scope**.
4. Fill the form:

   | Field | Value |
   |---|---|
   | Scope name | `access_as_user` |
   | Who can consent? | **Admins and users** |
   | Admin consent display name | `Access platform API as signed-in user` |
   | Admin consent description | `Allow the application to call the Enterprise Platform API on behalf of the signed-in user.` |
   | User consent display name | `Access platform API on your behalf` |
   | User consent description | `Allow the application to call the Enterprise Platform API as you.` |
   | State | **Enabled** |

5. **Add scope**. The full scope ID is now `api://<client-id>/access_as_user`.

> **If a scope with similar intent already exists** (e.g. `user_impersonation`),
> reuse it instead and substitute its name everywhere this doc says
> `access_as_user`.

### 3.5 Add the API permission to Test-Dev itself (single-registration trick)

Because the BFF and API are the same registration, the BFF must explicitly
hold a delegated permission to call its own scope. Entra does not auto-grant
this.

1. Left nav → **API permissions** → **+ Add a permission**.
2. **My APIs** tab → select **Test-Dev**.
3. **Delegated permissions** → check `access_as_user` → **Add permissions**.
4. The new permission appears with status "Not granted for \<tenant\>".
5. Click **Grant admin consent for \<tenant\>** → **Yes**. Status flips to a green check.

### 3.6 Add Microsoft Graph permissions

1. Same blade → **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**.
2. Check: `openid`, `profile`, `offline_access`, `User.Read`.
3. **Add permissions**.
4. Click **Grant admin consent for \<tenant\>**.

> `offline_access` is what unlocks **refresh-token** issuance. Without it,
> the BFF's silent token renewal cannot work and users get bounced to login
> after one hour.

> **Don't request the API scope and Graph User.Read in the same OIDC challenge.**
> Entra returns ONE access_token per request scoped to ONE resource. Mixing
> them produces a token usable for one and useless for the other. Our BFF
> requests `access_as_user` at sign-in; Graph tokens are acquired on-demand
> via the refresh token. (See memory: `feedback_entra_one_resource_per_token`.)

### 3.7 Token configuration (recommended)

1. Left nav → **Token configuration** → **+ Add optional claim** → **ID** token.
2. Check: `email`, `upn`, `tid`, `family_name`, `given_name`. **Add**.
3. If prompted "Turn on the Microsoft Graph email permission" → **Yes**.
4. Repeat **+ Add optional claim** → **Access** token → check `tid`. **Add**.

### 3.8 Pin token version to v2 (recommended)

1. Left nav → **Manifest**.
2. Find `"accessTokenAcceptedVersion"` (about 1/3 down).
3. If `null` → change to `2`. **Save**.

> **Why this matters.** With v2 tokens, the `aud` claim is the bare client
> ID (`<client-id>`). With v1 tokens, it's the Application ID URI
> (`api://<client-id>`). Your API's `AzureAd.Audience` setting must match
> whichever you choose.

### 3.9 App roles — verify and extend

1. Left nav → **App roles**.
2. You see **Administrator** already. Note its **Value** field — that's the
   string that lands in the JWT `roles` claim.
3. Decide:
   - **(a) Reuse "Administrator"** as your highest-privilege role. Your code already references whatever role names it expects — adapt one or the other to match.
   - **(b) Add additional roles** for our app: typically `Platform.Admin` and `Platform.User`.

4. To add a role: **+ Create app role**. Fill:

   | Field | Value |
   |---|---|
   | Display name | `Platform User` |
   | Allowed member types | **Users/Groups** |
   | Value | `Platform.User`  *(this is what appears in the `roles` claim)* |
   | Description | `Standard application user.` |
   | Do you want to enable this app role? | ✓ |

5. **Apply**. Repeat for `Platform.Admin`.

> **App roles live in Entra, not in your code.** Your TypeScript / C# code
> only sees the `roles` claim string array on the JWT. The role definitions
> are pure Entra config — that's why "App roles" doesn't appear when you
> grep the repo.

### 3.10 Assign your test user to a role

App registrations don't show user assignments. They live on the corresponding
**Enterprise Application** (every App Registration has a matching service
principal in Enterprise Apps).

1. Portal → **Microsoft Entra ID** → **Enterprise applications** → **All applications** → **Test-Dev**.
2. Left nav → **Users and groups** → **+ Add user/group**.
3. **Users** → pick yourself (and any test users) → **Select**.
4. **Select a role** → pick `Platform.Admin` (or `Administrator`, or whichever) → **Select**.
5. **Assign**.
6. (Optional) Left nav → **Properties** → set **Assignment required?** to **Yes** if you want to block sign-in by users not explicitly assigned. For dev, leaving it No is fine.

> The `roles` claim only appears in the JWT for users who have at least one
> role assignment on this Enterprise App. A user with zero assignments still
> signs in; they just get no `roles`.

---

## 4. Map the IDs into appsettings

### 4.1 BFF — `src/UI/Enterprise.Platform.Web.UI/appsettings.Development.json`

```jsonc
"AzureAd": {
  "Enabled": true,
  "Instance": "https://login.microsoftonline.com/",
  "TenantId": "<paste-from-step-3.1>",
  "ClientId": "<paste-from-step-3.1>",
  // ClientSecret comes from user-secrets (step 4.2) — NEVER commit it
  "CallbackPath": "/signin-oidc",
  "SignedOutCallbackPath": "/signout-callback-oidc",
  "ApiScope": "api://<paste-client-id>/access_as_user"
}
```

> **Never put the secret value in this file.** Use the user-secrets store.

### 4.2 BFF — Stash the client secret in user-secrets

From the repo root:

```bash
cd src/UI/Enterprise.Platform.Web.UI
dotnet user-secrets init     # only if not already initialised
dotnet user-secrets set "AzureAd:ClientSecret" "<paste-the-Value-from-step-3.3>"
dotnet user-secrets list     # sanity check — line appears
```

User-secrets land in `%APPDATA%\Microsoft\UserSecrets\<UserSecretsId>\secrets.json`,
outside the repo, picked up automatically in Development by
`WebApplication.CreateBuilder`.

### 4.3 API — `src/Api/Enterprise.Platform.Api/appsettings.Development.json`

```jsonc
"AzureAd": {
  "Instance": "https://login.microsoftonline.com/",
  "TenantId": "<same-as-BFF>",
  "ClientId": "<same-as-BFF>",
  // Audience — pick ONE of these based on token version (step 3.8):
  "Audience": "<same-as-BFF>"               // ← if accessTokenAcceptedVersion = 2 (recommended)
  // "Audience": "api://<same-as-BFF>"      // ← if accessTokenAcceptedVersion = null/1
}
```

> The API does **not** need a client secret. It only validates JWTs against
> Entra's published JWKS. The signing keys are public.

---

## 5. Smoke test (end-to-end)

```bash
# Terminal 1 — API
cd src/Api/Enterprise.Platform.Api
dotnet run
# expect: "Now listening on: https://localhost:5044"

# Terminal 2 — BFF (which also serves the SPA in dev)
cd src/UI/Enterprise.Platform.Web.UI
dotnet run
# expect: "Now listening on: http://localhost:5001"

# Terminal 3 — Angular dev (if separate)
cd src/UI/Enterprise.Platform.Web.UI/ClientApp
npm start
```

In a fresh browser:

1. Hit `http://localhost:5001` → should redirect to `/auth/login`.
2. Click **Sign in** → bounce to `login.microsoftonline.com` → pick your test user → consent (first time only).
3. Land on `/dashboard`.
4. Click **Test now** under "Verify backend connectivity" (lives at `dashboard.component.ts:127`).
5. Expect a green "✓ Authenticated — Api returned N claims" panel.

If green, every layer is wired:
- OIDC code+PKCE flow ✓
- Cookie session creation ✓
- Refresh-token attachment in proxy ✓
- API JWT signature validation ✓
- API `aud` claim match ✓

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Login → "AADSTS50011: redirect URI mismatch" | URI added to wrong registration, or wrong port/scheme | Verify `http://localhost:5001/signin-oidc` is in Test-Dev → Authentication → Web platform |
| Login → "AADSTS65001: consent required" | `Grant admin consent` skipped in step 3.5 / 3.6 | Re-grant for both Test-Dev's own scope and Microsoft Graph |
| Login → "AADSTS7000215: Invalid client secret provided" | Wrong secret value or typo | Verify with `dotnet user-secrets list`; regenerate (step 3.3) if unsure |
| BFF logs `IDX10500: Signature validation failed` | API has wrong `TenantId` | Match BFF + API tenant exactly |
| API returns 401 with `WWW-Authenticate: Bearer error="invalid_token", error_description="The audience is invalid"` | `Audience` setting doesn't match token's `aud` claim | Decode the token at jwt.ms, check `aud`, set `AzureAd.Audience` to match (see step 4.3) |
| `/whoami` succeeds but `claims.roles` is empty | User not assigned to an app role | Step 3.10 — assign yourself in Enterprise Applications |
| Refresh token absent / silent renewal fails | `offline_access` not granted in step 3.6 | Add it to API permissions, re-grant consent, sign out + back in (consent is one-shot) |
| `roles` claim arrives as comma-string not array | Custom Entra mapping policy | Decode at jwt.ms; if string-formatted, parse defensively in code |
| Duplicate `roles`/`amr`/`groups` claims | Multiple app-role assignments | Use `claims.GroupBy(c => c.Type)` server-side. (See memory: `feedback_entra_duplicate_claims`.) |

---

## 7. What you've achieved

- Test-Dev now serves a dual role: confidential OIDC client (for the BFF) and API resource (for the API).
- The BFF can complete the Authorization Code + PKCE flow, redeem tokens, store them in the session cookie, and proxy bearer-attached calls to the API.
- The API validates JWTs against Entra's public keys and reads `roles` for authorization.
- All existing config on Test-Dev (other redirect URIs, secrets, scopes, roles) is untouched.

When you eventually get permission to create a second registration, see
[`Docs/Security/bff-oidc-setup.md`](../Security/bff-oidc-setup.md) for the
two-registration split.
