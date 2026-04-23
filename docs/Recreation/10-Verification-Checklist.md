# 10 — Verification Checklist

> **Output of this doc.** A copy-pasteable checklist that proves each phase
> of the recreation is healthy before you build on top of it. Run from the
> top — first failing check is the one to fix.

## Phase ⓪ — Prerequisites verified

```bash
dotnet --version              # → 10.0.100 or higher patch
dotnet --list-sdks | grep "10\."
dotnet ef --version           # → 10.0.0
node --version                # → v22.x or higher
npm --version                 # → 11.8.0 or higher
git --version
sqlcmd -S localhost -E -Q "SELECT 'ok'"   # SQL Server reachable (or Docker variant)
```

✅ all commands print expected versions.

---

## Phase ① — Solution + projects scaffolded

```bash
cd <repo-root>
dotnet sln list
# Expect 8 production projects + DtoGen + (optionally tests).

dotnet build
# Expect: 0 warnings / 0 errors. Empty libraries + skeleton hosts compile.
```

✅ all projects listed; `dotnet build` clean.

---

## Phase ② — Packages + standards in place

```bash
# Sanity-check Directory.Packages.props is honored
grep -c "PackageVersion" Directory.Packages.props   # → 50+ entries
grep -rL "Version=\"" src --include="*.csproj" | wc -l   # → 0 (no versions in csproj files)

dotnet restore
# Expect: every project resolves; NO "Version conflict" or "missing version"
# errors. CPM is working.
```

✅ Central Package Management active; restore clean.

---

## Phase ③ — Settings POCOs validate

```bash
# Boot the Api with a deliberate misconfiguration (blank TenantId)
dotnet run --project src/API/Enterprise.Platform.Api
```

Expected output (intentional fail):

```
Microsoft.Extensions.Options.OptionsValidationException:
  AzureAd:TenantId must be set when AzureAd:Enabled is true.
```

That's the expected behavior — `ValidateOnStart` caught the missing config
at boot rather than at first 401.

✅ Now fix the misconfig and host boots cleanly.

---

## Phase ④ — Database + migrations

```bash
cd src/Infrastructure/Enterprise.Platform.Infrastructure

# Generate initial migration
dotnet ef migrations add InitialCreate \
  --context EventShopperDbContext \
  --output-dir Persistence/Migrations \
  --startup-project ../../API/Enterprise.Platform.Api

# Apply
dotnet ef database update \
  --context EventShopperDbContext \
  --startup-project ../../API/Enterprise.Platform.Api

# Verify schema
sqlcmd -S localhost -E -d EventShopperDb -Q \
  "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_NAME"
```

Expected: tables for every entity in `EventShopperDbContext` plus
`__EFMigrationsHistory`.

✅ schema present; migrations applied.

---

## Phase ⑤ — Api host smoke

Start the Api:

```bash
dotnet run --project src/API/Enterprise.Platform.Api
```

In another terminal:

```bash
# 1. Health endpoints (anonymous)
curl -s http://localhost:5044/health/live    | head -c 200
# → {"status":"Healthy","entries":{"self":...}}

curl -s http://localhost:5044/health/ready   | head -c 400
# → {"status":"Healthy","entries":{"eventshopper-db":...}}

# 2. OpenAPI document
curl -s http://localhost:5044/openapi/v1.json | head -c 200
# → JSON OpenAPI 3.0 spec

# 3. Whoami (anonymous → 401)
curl -si http://localhost:5044/api/v1/whoami | head -3
# → HTTP/1.1 401 Unauthorized
#    WWW-Authenticate: Bearer

# 4. Whoami with bad bearer → 401 invalid_token
curl -si -H "Authorization: Bearer fake.jwt.token" http://localhost:5044/api/v1/whoami | head -3
# → HTTP/1.1 401 Unauthorized
#    WWW-Authenticate: Bearer error="invalid_token"
```

✅ API boots, health endpoints green, OpenAPI doc served, JWT validation
correctly rejects fake tokens.

---

## Phase ⑥ — Web.UI (BFF) host smoke

Start the BFF:

```bash
dotnet run --project src/UI/Enterprise.Platform.Web.UI
# OR (Windows, WDAC) F5 in VS 2026 with the http profile
```

In another terminal:

```bash
# 1. Health endpoints (anonymous)
curl -s http://localhost:5001/health/live | head -c 200
curl -s http://localhost:5001/health/ready | head -c 400

# 2. Anonymous session probe
curl -s http://localhost:5001/api/auth/session
# → {"isAuthenticated":false,"name":null,"email":null,"roles":[],"expiresAt":null}

# 3. Anti-forgery token
curl -si http://localhost:5001/api/antiforgery/token | head -10
# → HTTP/1.1 200 OK
#    Set-Cookie: XSRF-TOKEN=... (readable)
#    Set-Cookie: __RequestVerificationToken=... (HttpOnly)
#    {"headerName":"X-XSRF-TOKEN"}

# 4. Login challenge
curl -si "http://localhost:5001/api/auth/login?returnUrl=/dashboard" | head -8
# → HTTP/1.1 302 Found
#    Location: https://login.microsoftonline.com/.../authorize?
#      client_id=<bff-client-id>&redirect_uri=...&response_type=code&...

# 5. Account-picker prompt
curl -si "http://localhost:5001/api/auth/login?prompt=select_account" | grep -i "Location:"
# → Location: ...&prompt=select_account&...

# 6. Open-redirect defense
curl -si "http://localhost:5001/api/auth/login?returnUrl=https://evil.com" | grep -i "Location:" | head -1
# → Location: contains state-encoded "/" (NOT evil.com)

# 7. Proxy without session → 302 to Entra (because [Authorize] + DefaultChallengeScheme=OIDC)
curl -si http://localhost:5001/api/proxy/v1/whoami | head -3
# → HTTP/1.1 302 Found
#    Location: https://login.microsoftonline.com/.../authorize?...
```

✅ BFF boots, all anonymous endpoints respond correctly, auth challenges
fire, open-redirect defense works.

---

## Phase ⑦ — Browser end-to-end (manual)

**Prerequisites:**
- Api running on `:5044`
- BFF running on `:5001`
- ng watch running (`cd src/UI/Enterprise.Platform.Web.UI/ClientApp && npm run watch`)
- Or Angular built into `dist/` and BFF reading from `SpaHosting.StaticRoot`
- Real Entra App Registration provisioned (see [`bff-oidc-setup.md`](../Security/bff-oidc-setup.md))
- `dotnet user-secrets set "AzureAd:ClientSecret"` populated

**Steps:**

1. Open `http://localhost:5001/` in an incognito window
2. App router redirects to `/auth/login` → click **Sign in with Microsoft**
3. Browser navigates to Entra → account picker shown (because LoginComponent
   passes `prompt=select_account`) → click your account → MFA if required
4. Return to BFF → cookie set → redirect to `/dashboard`
5. Dashboard renders with your name in the header
6. Click **Test now** on the "Verify backend connectivity" card
7. Expect green banner: ✓ Authenticated — Api returned ~27 claims
8. Open DevTools → Network → click `whoami` request:
   - Request URL: `http://localhost:5001/api/proxy/v1/whoami`
   - Request headers: NO `Authorization` (cookie-only)
   - Request headers: `X-Correlation-ID: <uuid>`
   - Response: 200 with the claim dump
9. Click **Sign out** → redirect to Entra → no account picker (because
   `id_token_hint` was sent) → bounce back to `/`

✅ full SPA → BFF → Entra → BFF → Api round-trip works under cookie session.

---

## Phase ⑧ — Worker host

Start the Worker:

```bash
dotnet run --project src/Batch/Enterprise.Platform.Worker
```

Watch console output. Expect:

```
[14:23:15 INF] Now running [Enterprise.Platform.Worker]
[14:23:15 INF] Outbox.Drain.Tick — processed 0 messages in 12ms.
[14:23:25 INF] Outbox.Drain.Tick — processed 0 messages in 4ms.
```

Outbox processor pings every `PollIntervalSeconds` (default 10s). On a clean
DB, count is 0 — that's fine.

✅ worker boots; OutboxProcessorJob runs on schedule.

---

## Phase ⑨ — SPA build / lint / arch / tests

```bash
cd src/UI/Enterprise.Platform.Web.UI/ClientApp

npm install --legacy-peer-deps
npm run lint              # → 0 warnings
npm run arch:check        # → 0 violations
npm run build             # → builds clean
npm run secrets:check     # → no leaked secrets

# (Vitest + Playwright + Storybook tests are out of recreation-scope
#  per the original ask, but the toolchain is installed.)
```

✅ SPA toolchain green.

---

## Phase ⑩ — Observability sinks

Optional — only if you wired the OTLP / Seq sinks per doc 09:

```bash
# Seq (logs)
docker run -d --name seq -e ACCEPT_EULA=Y -p 5341:80 datalust/seq
# Then set Observability:SeqEndpoint = "http://localhost:5341" in appsettings.Development.json
# Restart any host. Browse to http://localhost:5341.

# Jaeger (traces)
docker run -d --name jaeger -p 4317:4317 -p 16686:16686 jaegertracing/all-in-one:latest
# Then set Observability:OtelEndpoint = "http://localhost:4317".
# Restart any host. Browse to http://localhost:16686.

# dotnet-counters (metrics live view)
dotnet tool install --global dotnet-counters
dotnet-counters monitor --process-id <pid-of-bff> Enterprise.Platform.Web.UI
```

Make a few requests; confirm:
- Seq UI shows structured log lines with `CorrelationId`, `ServiceName`,
  `ServiceVersion` properties.
- Jaeger UI shows distributed traces spanning Web.UI → Api.
- dotnet-counters shows ticks for `ep.bff.session.created` after a login.

✅ telemetry pipelines reach their sinks.

---

## Phase ⑪ — End-to-end correlation trace

This is the canary that everything is wired together.

1. Start all three hosts (Api, Web.UI, Worker).
2. Open browser DevTools → Network tab.
3. Click **Test now** on the dashboard.
4. In Network tab, find the `whoami` request → copy `X-Correlation-ID` from
   Request headers (e.g. `abc-123`).
5. In your log sink (console / Seq), filter by `CorrelationId = abc-123`.
6. Expect to see entries from BOTH `enterprise-platform-web-ui` AND
   `enterprise-platform-api` services — the same correlation id traversed
   the BFF → Api hop because `ProxyController.Forward` explicitly forwarded
   the header.

✅ End-to-end correlation works.

---

## "Definition of Done" for the recreation

You're done when:

- [x] Phase ① — `dotnet build` clean
- [x] Phase ② — `dotnet restore` clean, no version-conflict warnings
- [x] Phase ③ — Bad config fails fast at boot; good config boots clean
- [x] Phase ④ — Initial migration applied, schema visible in SQL
- [x] Phase ⑤ — Api `/health/*` green, `/api/v1/whoami` 401-rejects fake bearer
- [x] Phase ⑥ — BFF `/health/*` green, anonymous `/api/auth/session` returns
      `{isAuthenticated:false}`, `/api/auth/login` 302s to Entra with all
      expected query params
- [x] Phase ⑦ — Full SPA login → dashboard → "Test now" green banner with
      27 claims
- [x] Phase ⑧ — Worker drain ticks emit on schedule
- [x] Phase ⑨ — SPA `lint` / `arch:check` / `build` all green
- [x] Phase ⑩ — Telemetry sinks reachable + receiving (optional but recommended)
- [x] Phase ⑪ — Single correlation id traverses Web.UI ↔ Api logs

If any phase fails, stop and fix before moving on. Each phase's failure is
diagnosable in isolation — chasing it after stacking three more phases on
top gets exponentially harder.

---

## Common failure modes (reference table)

| Symptom | Likely cause | Fix |
|---|---|---|
| `dotnet build` warns about CA1716 | Forgot `<NoWarn>$(NoWarn);CA1716</NoWarn>` in `Directory.Build.props` | Add it |
| `dotnet restore` says "version conflict" | A `<PackageReference>` carries a `Version=` attribute (CPM violation) | Remove the version; CPM picks from `Directory.Packages.props` |
| Host boots without complaining about missing `ClientSecret` | `AddValidatedOptions<EntraIdSettings>` not registered | Add the call in Program.cs / setup helper |
| Auth challenge → Entra → `AADSTS50011 redirect_uri mismatch` | App Registration's redirect URI doesn't EXACTLY match what the OIDC handler is sending | Add the URL Entra reports to the App Registration's redirect URIs verbatim |
| Sign-in succeeds but `/api/proxy/v1/whoami` returns 401 from Api | Stashed access_token has wrong audience (e.g. Graph token vs API token) | DON'T add `User.Read` to login scopes — see [`feedback_entra_one_resource_per_token`](../../C:/Users/hkgou/.claude/...) memory |
| `[AutoValidateAntiforgeryToken]` throws `No service for AutoValidateAntiforgeryTokenAuthorizationFilter` | Used `AddControllers()` instead of `AddControllersWithViews()` | Switch to `AddControllersWithViews()` |
| `MapFallback` doesn't match `/styles.css` etc. | Single-arg `MapFallback(handler)` uses `{*path:nonfile}` constraint | Use two-arg overload: `MapFallback("/{**catchAll}", handler)` |
| BFF static-root mode says `index.html not found` | Angular `dist/` not yet populated | Run `npm run watch` first; wait for initial build |
| WDAC blocks `dotnet run` on Windows | Application Control rejects unsigned DLLs | Use VS 2026 F5 with the `http` profile |
| Front-channel logout URL field rejects HTTP localhost in Entra portal | That field is HTTPS-only by Entra's policy | Leave it blank; add `signout-callback-oidc` as a normal redirect URI |

---

## Appendix — All the docs in this guide

| # | Doc |
|---|---|
| 00 | [INDEX](00-INDEX.md) |
| 01 | [Prerequisites](01-Prerequisites.md) |
| 02 | [Solution + scaffolding + folders](02-Solution-And-Scaffolding.md) |
| 03 | [Packages + standards](03-Packages-And-Standards.md) |
| 04 | [Configuration + settings](04-Configuration-And-Settings.md) |
| 05 | [Backend request flow](05-Backend-Request-Flow.md) |
| 06 | [BFF + frontend flow + interceptors](06-BFF-And-Frontend-Flow.md) |
| 07 | [Authentication + authorization](07-Authentication-And-Authorization.md) |
| 08 | [Database + persistence](08-Database-And-Persistence.md) |
| 09 | [Observability](09-Observability.md) |
| 10 | This file |

You now have a complete, self-contained recreation guide. Treat it as a
living document — when a foundational change lands, update the relevant doc
in the same PR.
