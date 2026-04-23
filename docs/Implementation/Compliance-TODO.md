# Compliance Implementation TODO

> **Living document.** Captures the gap between what the BFF/Api architecture
> currently enforces and what HIPAA / SOX / GDPR each genuinely require.
> Update checkboxes as work progresses; cross-reference any deferral
> decisions in `MEMORY.md` or an ADR.
>
> **Audit performed:** 2026-04-23, against the post-Phase-9 codebase
> (BFF cookie session, Entra OIDC, AuditLogs schema present but inert).
>
> **Companion docs:**
> - Architecture: [`../Architecture/UI-Architecture.md`](../Architecture/UI-Architecture.md), [`../Architecture/BFF-Session-Flow.md`](../Architecture/BFF-Session-Flow.md)
> - Auth setup: [`../Security/bff-oidc-setup.md`](../Security/bff-oidc-setup.md)
> - Smoke runbook: [`../Observability/auth-smoke-runbook.md`](../Observability/auth-smoke-runbook.md)
> - UI foundation TODO: [`UI-Foundation-TODO.md`](UI-Foundation-TODO.md)

---

## Status Legend

| Symbol | Meaning |
|:---:|---|
| `[ ]` | Pending — not started |
| `[~]` | In progress |
| `[x]` | Complete (code merged + verified) |
| `[!]` | Blocked — needs a decision or external input |
| `[–]` | Deferred / descoped — with rationale in Notes |
| ⚠️ | Plumbing exists but enforcement is inactive (false-positive checkmark risk) |
| ❌ | Not implemented at all |
| ✅ | Genuinely complete |

---

## Honest verdict (snapshot)

| Standard | Plumbing | Active enforcement | Audit-passable today? |
|---|---|---|---|
| **HIPAA** | 70 % | 30 % | ❌ — would not pass an HHS audit |
| **SOX** | 60 % | 15 % | ❌ — append-only audit + SoD policies missing |
| **GDPR** | 65 % | 40 % | ❌ — right-to-erasure missing; PII logging untreated |

The architecture is **well-positioned** for compliance — clean BFF separation,
no tokens in browser, structured logging, audit-table schema, role-guard
infrastructure, MFA-ready auth — but each domain needs **specific policy
enforcement code + organizational process** layered on top before the ✅s
become true.

---

## What IS already in place (genuinely ✅)

These items are real today and need no further work:

| Control | Where | Notes |
|---|---|---|
| Tokens never in browser | `BffAuthenticationSetup.cs` (`SaveTokens=true`), `BffProxyController.cs` | Browser only sees `ep.bff.session` HttpOnly cookie |
| OIDC code+PKCE auth | `BffAuthenticationSetup.cs` | `ResponseType=code`, `UsePkce=true` |
| Refresh-token rotation | `BffTokenRefreshService.cs` | Hooked via `OnValidatePrincipal`; 5-min threshold |
| CSRF on mutating verbs | `BffProxyController.cs` `[AutoValidateAntiforgeryToken]` | + Angular's built-in `withXsrfConfiguration` |
| Edge rate limiting | `BffRateLimiterSetup.cs` | Per-session + per-IP token buckets |
| BFF / Api correlation IDs | `BffProxyController.Forward` + middleware | `X-Correlation-ID` end-to-end |
| Header-delivered CSP w/ nonce | `BffSecurityHeaders.cs` | Replaced legacy `<meta>` CSP |
| Same-origin BFF topology | `Bff:Spa:StaticRoot` setup | No CORS surface for the SPA at all |
| Anti-clickjacking | `X-Frame-Options: SAMEORIGIN`, CSP `frame-ancestors 'self'` | Both enforced via header |
| Structured request logging | Serilog → Console (+ optional Seq) | Includes correlation id, sub, path, status, ms |
| OIDC single sign-out | `AuthController.Logout` + `OnRedirectToIdentityProviderForSignOut` | Includes `id_token_hint` |

---

## TIER 1 — Code changes, ~1 week, highest compliance impact

These deliver the largest false-positive-to-✅ flips. Implement first.

### 1.1 Activate `IAuditWriter` against the `AuditLogs` table
**Standards:** HIPAA 164.312(b), SOX access logs, GDPR breach forensics
**Status:** ⚠️ Schema present, no writer wired.

- [ ] **1.1.a** Replace `Infrastructure/Common/NullAuditWriter.cs` with a real
  `EventShopperAuditWriter` (or move to PlatformDb when D4 lifts).
  Fields to populate per row: `UserId` (sub claim), `TenantId` (claim),
  `ResourceType`, `ResourceId`, `Action` (`view`/`create`/`update`/`delete`),
  `CorrelationId`, `IpAddress`, `UserAgent`, `CreatedAt` (UTC).
- [ ] **1.1.b** Action-filter `[AuditPhi]` / `[AuditFinance]` / `[AuditPii]`
  attributes that auto-fire `IAuditWriter.LogAccess(...)` post-action.
  Keeps the per-endpoint code clean — single attribute = audit row.
- [ ] **1.1.c** Activate `Worker/Jobs/AuditRetentionJob.cs` (currently a
  placeholder) — DELETE rows older than `Audit:RetentionDays` (config; default
  2555 days = 7 years for HIPAA / SOX).
- [ ] **1.1.d** Audit table indexes already exist (`UserId`, `Action`,
  `ResourceType+ResourceId`, `CreatedAt`); verify query plans on the
  expected lookup patterns.

**Hotspot:** Audit writes must NEVER block or fail the actual operation.
Use `Channel<AuditEvent>` + a background drain so writes are async + lossy
on extreme back-pressure (better than blocking PHI access).

---

### 1.2 Make `AuditLogs` immutable (append-only)
**Standards:** SOX (immutable audit trail), HIPAA (anti-tampering)
**Status:** ❌ Currently a regular EF entity — UPDATE/DELETE allowed.

- [ ] **1.2.a** SQL trigger `INSTEAD OF UPDATE, DELETE ON dbo.AuditLogs`
  that throws — strictest, simplest. Allow purge ONLY via the retention
  job which runs as a separate SQL principal with explicit DELETE grant.
- [ ] **1.2.b** Alternative: SQL Server **system-versioned temporal table**
  — every row update writes to history. More sophisticated; higher cost.
- [ ] **1.2.c** EF model: mark `AuditLogs` entity as `IsNotSavedToHistory`
  / configure `OnModelCreating` to skip change-tracker UPDATE proxies.
- [ ] **1.2.d** Document rotation procedure — append-only retention delete
  is a privileged operation; needs separate SQL login + audit of the
  retention job's own runs.

---

### 1.3 MFA enforcement filter
**Standards:** HIPAA 164.312(d)
**Status:** ⚠️ MFA is a tenant-side Conditional Access policy we never verify.

- [ ] **1.3.a** Add `[RequireMfa]` authorization filter that inspects
  `User.FindAll("amr")` for `mfa` (or `pwd+otp` etc. depending on the
  factor used). Reject (403) if absent.
- [ ] **1.3.b** Apply `[RequireMfa]` to PHI / SOX-sensitive endpoints.
- [ ] **1.3.c** Document the required Conditional Access policy in
  `bff-oidc-setup.md` so the tenant admin enables MFA enforcement
  end-to-end (token without `amr=mfa` should never be issued in the first
  place — the filter is a belt-and-braces check).
- [ ] **1.3.d** Counter `ep.api.token.mfa_present{amr_value}` for telemetry
  — same pattern as `ep.api.token.audience_matched` (Phase 9.C.1).

---

### 1.4 Session timeout — absolute + idle
**Standards:** HIPAA 164.312(a)(2)(iii), SOX session timeout
**Status:** ❌ Currently 8h sliding only; no absolute cap, no separate idle timer.

Current: `AzureAdBffSettings.SessionLifetime = 8h` with `SlidingExpiration = true`.

- [ ] **1.4.a** Lower `SessionLifetime` default to 15 min (idle timeout).
  Express in `appsettings.json` so prod can override per workload
  (15 min for PHI/SOX surfaces, longer for low-sensitivity).
- [ ] **1.4.b** Add an **absolute** session cap independent of sliding
  refresh. Stash `session_started_at` in the cookie ticket (already done
  for metrics — `OnSigningIn` writes it); on `OnValidatePrincipal`, reject
  the principal when `now - session_started_at > AbsoluteLifetime` (default
  8h or 12h depending on workload).
- [ ] **1.4.c** SPA-side `SessionMonitorService` already polls
  `/api/auth/session` — extend to detect "absolute expiry near" and warn
  the user before the hard cut (different from the existing sliding-expiry
  warning).
- [ ] **1.4.d** Document the dev override (longer timeouts) in the README
  so devs aren't kicked out every 15 min during local dev.

---

### 1.5 PII redaction + structured-log hardening
**Standards:** GDPR (data minimization in logs), HIPAA (no PHI in plaintext logs)
**Status:** ❌ `sub` claim logged raw; no redaction.

- [ ] **1.5.a** Custom Serilog enricher — `PiiRedactingEnricher` — replaces
  values for known PII property names (`sub`, `email`, `userPrincipalName`,
  `name`) with HMAC-SHA256(value, instance-secret) so they're consistent
  across log lines but not reversible.
- [ ] **1.5.b** Add the enricher in `StructuredLoggingSetup`.
- [ ] **1.5.c** Ban raw PII via a Roslyn analyzer rule — any `LoggerMessage`
  template containing `{Email}` / `{UserName}` etc. must use the redacting
  enricher pipeline (or hash before passing).
- [ ] **1.5.d** Define + document a log retention policy — different sinks
  may have different retention based on data classification.

---

### 1.6 Browser security headers — round out the COxP / upgrade family
**Standards:** General defense-in-depth; reduces cross-origin attack surface
**Status:** ⚠️ Most headers set; COOP / CORP / `upgrade-insecure-requests` missing.

- [ ] **1.6.a** Add `Cross-Origin-Opener-Policy: same-origin` to
  `BffSecurityHeaders` — prevents window-handle attacks via
  `window.opener`.
- [ ] **1.6.b** Add `Cross-Origin-Resource-Policy: same-origin` —
  prevents cross-origin loads of the BFF's resources.
- [ ] **1.6.c** Add `Cross-Origin-Embedder-Policy: require-corp` for
  Spectre / cross-origin isolation (validate it doesn't break PrimeNG /
  any `<iframe>` content first; might need `credentialless` instead).
- [ ] **1.6.d** Add `upgrade-insecure-requests` directive to CSP — forces
  any accidentally-emitted `http://` resource to upgrade to HTTPS.

---

## TIER 2 — Code + infra, ~1 week

### 2.1 Right-to-erasure endpoint
**Standards:** GDPR Article 17
**Status:** ❌ No mechanism; deletion in Entra leaves orphaned data.

- [ ] **2.1.a** `IUserErasureService` — orchestrates: (1) cascade-delete
  user-owned records OR replace user FK with a sentinel "anonymized"
  user id, (2) anonymize the AuditLogs entries (replace `UserId` with
  hash; keep `Action` / `ResourceType` / `Timestamp` for SOX/HIPAA
  compliance — full deletion would itself be a SOX violation).
- [ ] **2.1.b** Admin endpoint `POST /api/admin/users/{id}/erase` — gated
  by a high-tier role (`Compliance.Officer`).
- [ ] **2.1.c** Background job for soft-delete → hard-delete after a
  grace period (typically 30 days).
- [ ] **2.1.d** Audit the erasure itself — paradoxically, GDPR allows
  retention of the FACT that an erasure was performed, even when the
  data is gone.

---

### 2.2 Centralized log sink with retention policy
**Standards:** GDPR breach notification (72h forensic window), SOX retention
**Status:** ⚠️ Console + optional Seq; no centralized retention-enforced sink.

- [ ] **2.2.a** Add Application Insights / Log Analytics sink to
  `StructuredLoggingSetup` (gated on `Observability.AppInsightsConnectionString`).
- [ ] **2.2.b** Configure retention per sink — typically 7 years for
  audit-classified events, 90 days for diagnostics.
- [ ] **2.2.c** Define + document RBAC on the sink — only Security Team
  has read access to PHI-classified logs.
- [ ] **2.2.d** Alert rules in App Insights for: 5xx spike, 401-spike
  (session-expiry waves), refresh-token rotation failure rate, audit-write
  failure (Tier 1.1 hotspot).

---

### 2.3 Data-protection key storage for prod
**Standards:** HIPAA integrity, session continuity in scaled deployments
**Status:** ⚠️ Removed `PersistKeysToFileSystem` per dev preference; in-memory only.

- [ ] **2.3.a** For prod: `services.AddDataProtection().PersistKeysToAzureBlobStorage(...)
  .ProtectKeysWithAzureKeyVault(...)`. Wrap in `if (!app.Environment.IsDevelopment())`
  so dev keeps the in-memory regenerate-on-restart behavior.
- [ ] **2.3.b** Define key rotation policy — Azure-side handles it, but
  document the impact (rolling cookie regeneration ≠ instant logout).
- [ ] **2.3.c** Document multi-instance prerequisites — without this,
  scaling the BFF horizontally breaks sessions for the unlucky user that
  load-balances to a different pod.

---

### 2.4 Vulnerability scanning in CI
**Standards:** General hygiene; required by most enterprise sec reviews
**Status:** ❌ Not in pipeline.

- [ ] **2.4.a** `dotnet list package --vulnerable --include-transitive`
  step in CI; fail on Moderate or higher.
- [ ] **2.4.b** `npm audit --audit-level=moderate` in the SPA's CI step.
- [ ] **2.4.c** GitHub Dependabot / Azure DevOps equivalent enabled at
  the repo level.
- [ ] **2.4.d** Schedule weekly job that re-runs scans on the deployed
  image (libraries vulnerable today might be flagged tomorrow).

---

### 2.5 Encryption at rest for sensitive columns
**Standards:** HIPAA, GDPR (special categories of personal data)
**Status:** ❌ No domain entities yet; pattern needed when first PHI/PII column lands.

- [ ] **2.5.a** Decide pattern: SQL Always Encrypted (column-level) vs.
  app-layer EF value converter with a Key Vault key. Always Encrypted
  prevents the BFF process from ever holding plaintext (strongest);
  EF converter is simpler but holds plaintext briefly in memory.
- [ ] **2.5.b** Convention for marking columns: `[Encrypted]` attribute
  on entity properties; `OnModelCreating` wires the value converter.
- [ ] **2.5.c** Backup encryption — Azure SQL automatic encrypted backups;
  document that this depends on Azure-side configuration (TDE on by default).

---

## TIER 3 — Process + governance (NOT code)

These are organizational deliverables, often required by auditors but not
implementable by an engineer alone.

- [ ] **3.1** Privacy policy + cookie banner (UI feature)
- [ ] **3.2** Consent management UX (track which users have consented to what)
- [ ] **3.3** Terms of service + acceptable-use policy
- [ ] **3.4** Data processing agreements (DPA) with sub-processors (Microsoft, etc.)
- [ ] **3.5** Incident response runbook (`Docs/Runbooks/IncidentResponse.md`)
- [ ] **3.6** Penetration test before going live (scheduled, recurring)
- [ ] **3.7** Data classification scheme (PHI / PII / SOX / Public) +
  labeling convention applied to every new entity / DTO
- [ ] **3.8** Business Associate Agreement (BAA) with Microsoft for HIPAA workloads
- [ ] **3.9** Periodic access review — quarterly review of who has admin
  / privileged roles
- [ ] **3.10** Disaster recovery + business continuity plan (RPO / RTO targets)
- [ ] **3.11** Compliance officer role assignment + sign-off process

---

## Per-standard quick reference

### HIPAA Technical Safeguards (45 CFR §164.312)

| Requirement | Status | Tier-1 work | Tier-2 work | Tier-3 work |
|---|---|---|---|---|
| (a)(1) Access control | ⚠️ Plumbing | 1.1, 1.3 | — | 3.7 |
| (a)(2)(iii) Auto logoff | ❌ 8h, no absolute | 1.4 | — | — |
| (b) Audit controls | ⚠️ Request only | 1.1, 1.5 | 2.2 | — |
| (c)(1) Integrity | ✅ Tokens | 1.2 | 2.5 | — |
| (d) Authentication | ⚠️ Trust Entra | 1.3 | — | 3.8 |
| (e)(1) Transmission security | ⚠️ HTTPS partial | 1.6 | 2.3 | — |

### SOX Section 404 IT controls

| Requirement | Status | Tier-1 work | Tier-2 work |
|---|---|---|---|
| Access logs (financial data) | ❌ No per-record audit | 1.1 | 2.2 |
| Separation of duties | ❌ No Finance roles defined | 1.1 + future Finance domain | — |
| Immutable audit trail | ❌ Mutable today | 1.2 | — |
| Session timeout | ❌ 8h | 1.4 | — |

### GDPR (key articles for an HR/personal-data app)

| Article | Status | Tier-1 | Tier-2 | Tier-3 |
|---|---|---|---|---|
| Art. 5(1)(c) — data minimisation | ✅ /session, ⚠️ /me/profile | 1.5 | — | — |
| Art. 5(1)(f) — integrity & confidentiality | ✅ Token, ⚠️ at-rest | 1.6 | 2.5 | — |
| Art. 17 — right to erasure | ❌ Not implemented | — | 2.1 | — |
| Art. 25 — privacy by design | ⚠️ Partial | 1.1, 1.5 | — | 3.7 |
| Art. 30 — records of processing | ⚠️ Logs but not classified | 1.1 | 2.2 | 3.7 |
| Art. 32 — security of processing | ⚠️ Multiple | All Tier 1 | All Tier 2 | 3.6 |
| Art. 33 — breach notification (72h) | ⚠️ Logs partial | 1.5 | 2.2 | 3.5 |
| Art. 5(1)(e) — storage limitation | ❌ No retention policy | 1.1.c | 2.2 | — |

---

## Phasing recommendation

If picking this up, work the tiers strictly in order (1 → 2 → 3). Tier 1 is
all code + the highest impact-per-day; Tier 2 mixes code with infra (Azure
resources, CI changes); Tier 3 is governance work that no amount of code
solves.

Within Tier 1, the dependency order is:

1. **1.1 + 1.2 first** (audit infrastructure — everything else depends on
   "we can prove what happened")
2. **1.3** (MFA enforcement — small, isolated, high audit value)
3. **1.4** (session timeout — needs to be tunable per workload before
   broad rollout)
4. **1.5** (PII redaction — depends on Serilog config; coordinate with
   2.2 sink choice)
5. **1.6** (browser headers — independent, can land any time)

---

## When this document gets revisited

- After D4 lifts (PlatformDb online) — many `[ ]` items unblock together
- Before any production deployment — Tier 1 + 2 items must be at least
  triaged for that workload's compliance scope
- When a new compliance domain enters scope (PCI-DSS, FedRAMP, etc.) —
  add a new section + matrix
