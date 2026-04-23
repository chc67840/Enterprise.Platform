# 07 — Authentication + Authorization (end-to-end)

> **Output of this doc.** Complete picture of how identity flows: SPA →
> BFF → Entra → BFF → Api. Role/permission enforcement at every layer.
> Microsoft Graph token acquisition. Step-up auth via `prompt=login`.

> **Companion:** [`Docs/Architecture/BFF-Session-Flow.md`](../Architecture/BFF-Session-Flow.md)
> for sequence diagrams. [`Docs/Security/bff-oidc-setup.md`](../Security/bff-oidc-setup.md)
> for the Entra portal walkthrough.

## 1. Identity model (one-paragraph summary)

The Web.UI host is a **confidential OIDC client** against Microsoft Entra ID.
It runs the Authorization Code + PKCE flow, receives id/access/refresh
tokens at `/signin-oidc`, and stores them server-side in the cookie ticket
(`SaveTokens=true`). The browser never sees a token — only a HttpOnly
SameSite=Strict session cookie. Downstream Api calls flow through
`ProxyController`, which attaches the stashed bearer token server-side. The
Api validates the JWT against Entra's published JWKS using
`Microsoft.Identity.Web` + `JwtBearer`. Permissions (fine-grained) are
hydrated from a placeholder `/api/auth/me/permissions` endpoint until D4
(PlatformDb) lifts.

## 2. App Registrations in Entra

The platform uses **two App Registrations** (rationale documented in
`bff-oidc-setup.md` § "Why a second App Registration"):

| Registration | Platform type | Purpose |
|---|---|---|
| **SPA registration** (e.g. `a703a89e-…`) | Single-page application | Exposes the Api via "Expose an API" + scope `access_as_user`. The Api validates `aud` claims against this client id. |
| **Web.UI registration** (e.g. `e595df6f-…`) | Web | Confidential client used by the BFF for the OIDC code+PKCE flow. Has a client secret (in user-secrets / Key Vault). API permissions: Graph (`User.Read`, `openid`, `profile`, `offline_access`) + the SPA registration's `access_as_user`. |

**Why two?** Flipping the SPA registration to "Web" platform (required for
confidential client) is destructive. A second registration keeps both paths
alive and makes rollback trivial.

## 3. OIDC scopes requested at login

The Web.UI host requests **only**:

```
openid
profile
offline_access
api://<spa-client-id>/access_as_user
```

**Critically, NOT `User.Read` (Microsoft Graph).** Entra returns ONE
access_token per request scoped to ONE resource. Mixing the API scope and
a Graph scope produces a token usable for one and useless for the other —
the gotcha caught in
[`feedback_entra_one_resource_per_token`](../../C:/Users/hkgou/.claude/...) memory.

`User.Read` is admin-consented at the App Registration level, so Graph
tokens are acquired on-demand via `refresh_token` (see §6).

## 4. Login flow (with `prompt` parameter)

```
GET /api/auth/login?returnUrl=/dashboard&prompt=select_account
    ↓
AuthController.Login:
  - SanitizeReturnUrl  (Url.IsLocalUrl ⇒ "/dashboard" or default "/")
  - SanitizePrompt     (allowlist: "select_account" | "login" | null)
  - If User.Identity.IsAuthenticated && prompt is null → 302 to returnUrl (idempotent)
  - Else: Challenge(OidcScheme,
                    AuthenticationProperties {
                        RedirectUri = "/dashboard",
                        Items["ep.bff.prompt"] = "select_account"
                    })
    ↓
PlatformAuthenticationSetup OIDC events:
  - OnRedirectToIdentityProvider: reads Items["ep.bff.prompt"]
                                  → ProtocolMessage.Prompt = "select_account"
                                  → for localhost, rewrite RedirectUri to http://localhost:5001/signin-oidc
    ↓
302 to https://login.microsoftonline.com/.../authorize
    ?client_id=<bff-client-id>
    &redirect_uri=http://localhost:5001/signin-oidc
    &response_type=code
    &response_mode=form_post
    &scope=openid profile offline_access api://<spa-client-id>/access_as_user
    &code_challenge=...&code_challenge_method=S256
    &state=...&nonce=...
    &prompt=select_account
    ↓
Entra account-picker shown; user picks account (or signs in)
    ↓
POST /signin-oidc with form-encoded { code, state }
    ↓
OpenIdConnectHandler:
  - validates state + nonce
  - exchanges code for tokens (PKCE verifier match)
  - validates id_token signature against Entra JWKS
  - SaveTokens=true → stash access/refresh/id in cookie ticket
    ↓
Cookie scheme SignIn:
  - OnSigningIn: SessionMetrics.SessionsCreated++; stash session_started_at
  - Set-Cookie: ep.bff.session=<encrypted ticket>
    ↓
302 to RedirectUri (= "/dashboard" from state)
    ↓
Browser → /dashboard → SpaFallback serves index.html → SPA boots
```

## 5. Refresh-token rotation

Hooked into the cookie scheme's `OnValidatePrincipal` event — fires on
**every authenticated request**:

```csharp
options.Events.OnValidatePrincipal = async ctx =>
{
    var refresher = ctx.HttpContext.RequestServices
        .GetRequiredService<TokenRefreshService>();
    await refresher.ValidateAsync(ctx);
};
```

`TokenRefreshService.ValidateAsync`:

1. Reads stashed `access_token`, `refresh_token`, `expires_at` from ticket
2. Missing tokens → `RejectPrincipal()` → next request gets 401
3. Parses `expires_at` (ISO-8601); malformed → reject
4. If `secondsRemaining > 5min` → log Skip, return (fast path)
5. Otherwise: POST to `{Authority}/oauth2/v2.0/token`:
   ```
   grant_type=refresh_token
   client_id=<bff-client-id>
   client_secret=<from user-secrets>
   refresh_token=<stashed>
   scope=openid profile offline_access {ApiScope}
   ```
6. Network error → `SessionsRefreshFailed{reason=network}` + reject
7. Non-2xx → `SessionsRefreshFailed{reason=http_4xx}` + reject
8. Success: write new tokens to ticket (Entra may rotate refresh_token too),
   `ShouldRenew = true` → cookie re-issued with new tokens
9. `SessionsRefreshed` counter ticks

**Result.** As long as the user stays active, sessions live indefinitely.
When refresh fails (refresh_token expired, secret rotated), principal is
rejected → 401 → SPA's `errorInterceptor` redirects to `/auth/login`.

## 6. Microsoft Graph token acquisition (on-demand)

`GraphUserProfileService.AcquireGraphTokenAsync`:

```csharp
// 1. Read refresh_token from cookie ticket
var refreshToken = await context.GetTokenAsync(CookieScheme, "refresh_token");

// 2. POST to Entra token endpoint with Graph scope
var body = new FormUrlEncodedContent(new[]
{
    new KeyValuePair<string, string>("grant_type", "refresh_token"),
    new KeyValuePair<string, string>("client_id", azureAd.ClientId),
    new KeyValuePair<string, string>("client_secret", azureAd.ClientSecret),
    new KeyValuePair<string, string>("refresh_token", refreshToken),
    new KeyValuePair<string, string>("scope", GraphConstants.UserReadScope),
});

var response = await http.PostAsync(tokenEndpoint, body);
var payload = await response.Content.ReadFromJsonAsync<EntraTokenResponse>();
return payload.AccessToken;  // Graph-scoped, NOT API-scoped
```

Then used to call `https://graph.microsoft.com/v1.0/me?$select=...`. Cached
per-user for 5 minutes via `IMemoryCache`.

This works because:
- The refresh_token isn't audience-scoped
- `User.Read` is admin-consented at the App Registration → no consent prompt
- Each call mints a token specifically for Graph (not for the platform Api)

## 7. Logout flow with `id_token_hint`

```
POST /api/auth/logout?returnUrl=/
    ↓
AuthController.Logout:
  SignOut(CookieScheme, OidcScheme,
          AuthenticationProperties { RedirectUri = "/" })
    ↓
Cookie scheme:
  OnSigningOut: SessionMetrics.SessionLifetimeSeconds.Record(now - session_started_at)
  Set-Cookie: ep.bff.session=  (deleted)
    ↓
OIDC scheme:
  OnRedirectToIdentityProviderForSignOut:
    var idToken = await ctx.HttpContext.GetTokenAsync(CookieScheme, "id_token");
    ctx.ProtocolMessage.IdTokenHint = idToken;   // tells Entra WHICH session
    ↓
302 to https://login.microsoftonline.com/.../oauth2/v2.0/logout
    ?id_token_hint=<the user's id_token>
    &post_logout_redirect_uri=http://localhost:5001/signout-callback-oidc
    ↓
Entra clears its session — NO account picker thanks to id_token_hint
    ↓
302 back to /signout-callback-oidc
    ↓
OIDC handler redirects to AuthenticationProperties.RedirectUri = "/"
```

## 8. Api host — JWT validation (policy scheme)

The Api uses `Microsoft.Identity.Web` + `JwtBearer` with a **policy scheme**
that routes incoming bearer tokens by issuer:

```csharp
// src/API/Enterprise.Platform.Api/Configuration/AuthenticationSetup.cs
authBuilder.AddPolicyScheme(PolicyScheme, PolicyScheme, options =>
{
    options.ForwardDefaultSelector = context =>
    {
        var token = ctx.Request.Headers.Authorization.ToString()["Bearer ".Length..].Trim();
        var issuer = TryReadIssuer(token);

        if (b2cEnabled && issuer.Contains(b2cSettings.Domain, ...))
            return B2CScheme;
        if (entraEnabled && issuer.Contains("login.microsoftonline.com", ...))
            return B2BScheme;
        return entraEnabled ? B2BScheme : (b2cEnabled ? B2CScheme : DevScheme);
    };
});
```

Three schemes:

| Scheme | Token validator | When used |
|---|---|---|
| `B2BScheme` (default) | `Microsoft.Identity.Web` for Entra B2B | Production — token from `login.microsoftonline.com` |
| `B2CScheme` | `Microsoft.Identity.Web` for Entra B2C | When `EntraIdB2C.Enabled=true` and token from B2C tenant |
| `DevScheme` | Symmetric-key `JwtBearer` | When both Entra schemes disabled — local dev with `JwtSettings.SigningKey` |

### 8.1 Validation parameters (B2B)

```csharp
options.TokenValidationParameters.ValidAudiences = settings.Audiences;
options.TokenValidationParameters.ValidateIssuer = true;
options.TokenValidationParameters.ValidIssuers = settings.AllowedIssuers;
```

### 8.2 OnTokenValidated event — does two things

1. **Tenant mapping** — read Entra `tid` claim, look up in
   `EntraIdSettings.PlatformTenantMapping` dict, add derived
   `ep:tenant_id` claim. `CurrentTenantService` reads it transparently.

2. **Audience-match telemetry** — `AudienceMatchMetric` counter (Phase 9.C.1)
   tags each token by audience kind (`api_prefixed` / `implicit_clientid` /
   `other` / `missing`). Drives the eventual hardening to reject
   non-`api://` audiences.

## 9. Authorization policies + role/permission checks

### 9.1 Server-side (Api)

Standard `[Authorize(...)]` attributes on minimal-API endpoints / controllers:

```csharp
app.MapGet("/api/v1/admin/things", AdminThingsHandler)
   .RequireAuthorization()   // requires authenticated user
   .RequireAuthorization(p => p.RequireRole("admin"))   // role-based
   .RequireAuthorization(p => p.Requirements.Add(new PermissionRequirement("things:read")));
```

`PermissionRequirement` + `PermissionAuthorizationHandler` (in
`Infrastructure/Identity/Authorization/`) check effective permissions
hydrated by `IPermissionService`. Today the implementation is a placeholder
(D4-deferred — see `Compliance-TODO.md`).

### 9.2 Client-side (SPA)

| Surface | Where |
|---|---|
| Route guards | `core/guards/{auth,permission,role}.guard.ts` |
| Structural directives | `core/directives/has-permission.directive.ts`, `has-role.directive.ts` |
| Programmatic checks | `inject(AuthStore).hasPermission('users:read')` |

The hydrated `AuthStore` reads `/api/auth/me/permissions` (BFF-owned
placeholder until D4); roles surface from session claims today.

## 10. CSRF (XSRF) — double-submit cookie pattern

| Cookie | Set by | Read by |
|---|---|---|
| `__RequestVerificationToken` (HttpOnly) | ASP.NET antiforgery | Server-side validation |
| `XSRF-TOKEN` (readable) | `AntiforgeryController.GetToken` | SPA's Angular `withXsrfConfiguration` reads value, attaches as `X-XSRF-TOKEN` header on mutating XHRs |

Server-side validation: `[AutoValidateAntiforgeryToken]` on
`ProxyController`. `Mvc.ViewFeatures` filter MUST be available — that
requires `AddControllersWithViews()` in Program.cs (NOT the minimal
`AddControllers()`; see
[`feedback_addcontrollerswithviews_antiforgery`](../../C:/Users/hkgou/.claude/...) memory).

## 11. Step-up auth (`prompt=login`)

For sensitive operations, force credential re-entry:

```typescript
// SPA — before destructive action
this.auth.login(currentRoute, 'login');   // forces full credential re-entry
```

The BFF's `OnRedirectToIdentityProvider` event passes `prompt=login` to
Entra, which presents the credential prompt even if the user has an active
SSO session.

## 12. MFA enforcement (planned — Compliance-TODO 1.3)

Not currently enforced in code. Today:
- MFA is a tenant-side Conditional Access policy in Entra
- Token's `amr` claim contains `mfa` when MFA was used
- `[RequireMfa]` filter (planned) will inspect `amr` and reject endpoints
  that require it

---

**Next:** [`08-Database-And-Persistence.md`](08-Database-And-Persistence.md) —
EF Core 10 setup, DbContexts, migrations, repositories, the outbox pattern.
