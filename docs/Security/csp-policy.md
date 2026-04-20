# Content Security Policy — Target Policy & Deployment

> **Status.** Baseline policy (static-host, `<meta>`-emitted) lands in Phase 2.2.
> Nonce-based policy emitted by the BFF is the Phase-9 production target.
>
> **Companion docs:**
> [`../Architecture/UI-Architecture.md`](../Architecture/UI-Architecture.md) §3.4 ·
> [`../Implementation/UI-Foundation-TODO.md`](../Implementation/UI-Foundation-TODO.md)
> Phase 2.2 / Phase 9.5.

---

## 1. Policy (production target)

```
default-src  'self';
script-src   'self' 'nonce-<REQUEST_NONCE>' 'strict-dynamic';
style-src    'self' 'nonce-<REQUEST_NONCE>';
img-src      'self' data: https:;
font-src     'self' data:;
connect-src  'self' https://api.example.com https://login.microsoftonline.com https://graph.microsoft.com https://*.in.applicationinsights.azure.com;
frame-ancestors 'none';
base-uri     'self';
form-action  'self';
object-src   'none';
upgrade-insecure-requests;
report-uri   /api/csp-report;
report-to    csp-endpoint;
```

`Report-To` header (sent by the BFF alongside the CSP):

```
Report-To: { "group": "csp-endpoint", "max_age": 10886400, "endpoints": [{ "url": "/api/csp-report" }] }
```

### Why these directives

| Directive | Rationale |
|---|---|
| `default-src 'self'` | All non-overridden fetches must come from the hosting origin. Every looser directive below is a conscious exception. |
| `script-src 'nonce-… 'strict-dynamic'` | Nonces block arbitrary inline `<script>` but still allow the SPA's own bundle (which carries the nonce from `index.html`). `strict-dynamic` then trusts any script the bundle loads transitively — avoids having to enumerate CDNs when we introduce dynamic imports. |
| `style-src 'nonce-…'` | Same logic for styles. Tailwind v4 emits its utilities via external CSS; PrimeNG emits via external CSS + component tokens. No inline `style=""` is produced by the build today (see §3). |
| `img-src 'self' data: https:` | `data:` for inlined SVG icons; `https:` so avatar URLs resolve when users paste them from external services. |
| `connect-src` | Explicitly enumerates API + Entra + Graph + App Insights. Anything else is blocked. |
| `frame-ancestors 'none'` | Clickjacking defence. Stricter than `X-Frame-Options: DENY` because CSP is enforced by all modern browsers while `XFO` was deprecated. |
| `object-src 'none'` | No `<object>` / `<embed>` / legacy plugin surfaces. |
| `upgrade-insecure-requests` | Defence in depth — any leftover `http://` URL in a third-party dependency is upgraded silently. |

### Why nonces (not `'unsafe-inline'`)

`'unsafe-inline'` on `script-src` defeats the entire defence against XSS. We
never ship with it. Nonces are a single per-response random value stamped onto
every `<script>` the SPA controls; an attacker who injects HTML cannot predict
the nonce and their injected `<script>` is blocked.

---

## 2. Deployment modes

### 2.1 Static-host scenario (Phase 2 baseline)

When the SPA is served from a static origin (SWA, CloudFront, nginx), the CSP
is emitted via `<meta http-equiv="Content-Security-Policy">` inside
`index.html` as a **starter** policy. No nonce — we fall back to the
strictest practical policy without one:

```
default-src 'self';
script-src  'self';
style-src   'self' 'unsafe-inline';  ← required for PrimeNG dynamic CSS
img-src     'self' data: https:;
font-src    'self' data:;
connect-src 'self' https://api.* https://login.microsoftonline.com https://graph.microsoft.com https://*.in.applicationinsights.azure.com;
frame-ancestors 'none';
base-uri    'self';
form-action 'self';
object-src  'none';
upgrade-insecure-requests;
```

> **NOTE.** `style-src 'unsafe-inline'` is tolerated here only because
> PrimeNG's runtime theme engine appends inline `<style>` nodes. This is the
> single reason the nonce path (Phase 9) is preferred for production — once
> the BFF is in front of the SPA, all styles regain nonce enforcement.

For host-level headers (nginx example):

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; …" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### 2.2 BFF-mediated scenario (Phase 9 production)

When `Enterprise.Platform.Web.UI` (the .NET BFF) fronts the SPA:

1. Per-response nonce generation — middleware mints a crypto-random 128-bit
   value, writes it into `HttpContext.Items`, and serves it to the Razor view.
2. `index.html` rendered server-side with every `<script>` / `<style>` tag
   carrying `nonce="<REQUEST_NONCE>"`.
3. `Content-Security-Policy` response header emitted by the BFF with the
   full policy from §1.
4. `Report-To` header + `/api/csp-report` endpoint consume violations and
   forward to telemetry.

See `src/UI/Enterprise.Platform.Web.UI/Configuration/BffSecurityHeaders.cs`
for the existing non-CSP header stack; the nonce + CSP middleware wires in
alongside it in Phase 9.

---

## 3. Audit (Phase 2.2.2)

A codebase scan at Phase-2 landing found **zero** in-app CSP violations:

| Pattern | Occurrences | Notes |
|---|---|---|
| `innerHTML` / `[innerHTML]` | 0 | |
| `style=""` inline attribute | 0 | Tailwind classes + external CSS only |
| `onerror=` / `onclick=` inline | 0 | Every handler is a `(click)` binding |
| `javascript:` URL | 0 | |
| `eval(` / `Function(` | 0 | ESLint `security/detect-eval-with-expression` enforces |

Re-run this audit whenever adding a third-party component (PrimeNG extensions,
chart libraries, rich-text editors) — such dependencies are the common source
of inline style/script that trips CSP.

---

## 4. Violation reporting (Phase 2.2.5)

The SPA registers a `securitypolicyviolation` listener at bootstrap
(`CspViolationReporterService`). Every violation is:

1. Scrubbed via `LoggerService.scrub(...)` so blocked URIs with PII are masked
   (query strings can carry emails, tokens, etc.).
2. Forwarded to the in-browser logger as a `warn` record.
3. Mirrored to the backend `report-uri` (when the CSP carries one — i.e. BFF
   scenario) so backend alerting can page on-call.

### Response action

A CSP violation reaching production means one of:
- Third-party dependency upgraded and introduced a new inline source → needs
  a policy diff or library pin.
- XSS attempt was blocked → security-incident review, log pivot via the
  correlation id.
- Code review missed an inline `style`/`script` → fix in source.

Never relax the policy to silence the report until root cause is understood.
