# Enterprise.Platform — Client (Angular 21 SPA)

Angular 21 single-page application that fronts the Enterprise.Platform APIs.
Hosted by the sibling .NET BFF (`../` — `Enterprise.Platform.Web.UI`) in
cookie-session mode, or deployable as a static site in MSAL-direct mode.

> **Target architecture:** [`../../../../Docs/Architecture/UI-Architecture.md`](../../../../Docs/Architecture/UI-Architecture.md)
> **Implementation backlog:** [`../../../../Docs/Implementation/UI-Foundation-TODO.md`](../../../../Docs/Implementation/UI-Foundation-TODO.md)
> **Current-state audit (legacy `enterprise-app` reference):** [`../../../../Docs/Review/UI-Deep-Review-2026-04-20.md`](../../../../Docs/Review/UI-Deep-Review-2026-04-20.md)

---

## Quick start

```bash
npm install      # installs pinned deps (~500 MB)
npm run start    # serves http://localhost:4200 (dev)
npm run build    # production build → dist/enterprise-platform-client/
npm run test     # Vitest runner (specs land Phase 4)
npm run format   # Prettier across src/
```

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Angular 21** | Zoneless, standalone, signals |
| State | **NGRX Signals** (`@ngrx/signals`, `@ngrx/operators`) | Signal-native, minimal ceremony |
| UI kit | **PrimeNG 21** + themes | Comprehensive widget set; Aura preset |
| Styling | **Tailwind v4** | Utility-first; CSS layers cohabit with PrimeNG |
| Auth | **@azure/msal-angular** (+ BFF cookie mode later) | Entra ID SSO |
| Validation | **Zod** | Shared contract with backend |
| HTTP | Angular HttpClient + functional interceptors | Chain per Architecture §4.3 |
| Tests | **Vitest** + jsdom | ES-native; Angular 21 first-class |
| Build | **@angular/build** (esbuild) | Fast; modern |

See [`../../../../Docs/Architecture/UI-Architecture.md`](../../../../Docs/Architecture/UI-Architecture.md) for the full spec.

---

## Project layout

```
ClientApp/
├── public/              # static assets copied verbatim
│   └── config.json      # runtime config (Phase 2.1 wiring)
├── src/
│   ├── app/
│   │   ├── config/      # provider graph, MSAL factories, PrimeNG preset, theme
│   │   ├── core/        # auth, guards, http, interceptors, models, services, base store
│   │   ├── shared/      # UI primitives, directives, pipes, dynamic-form
│   │   ├── layouts/     # AppShell, AuthLayout, ErrorLayout
│   │   ├── features/    # vertical slices per aggregate
│   │   ├── app.ts       # root component (AppComponent)
│   │   └── app.routes.ts
│   ├── environments/    # build-time config POCOs
│   ├── styles/          # global tokens, typography, animations, overrides
│   ├── index.html
│   ├── main.ts          # bootstrap entry
│   └── styles.css       # global CSS entry (Tailwind v4 + PrimeNG layering)
├── angular.json
├── package.json
├── tsconfig.json
└── ...
```

---

## Environment

### Ports

| Service | URL |
|---|---|
| Angular dev server | <http://localhost:4200> |
| BFF (Enterprise.Platform.Web.UI) | as configured (`dotnet run --project ../..`) |
| API (Enterprise.Platform.Api) | <http://localhost:5044> |

### Runtime config

`public/config.json` is read at boot via `loadRuntimeConfig()` (see
`src/app/config/runtime-config.ts`). Each deployment overwrites the file at
release time; the SPA uses `environment.ts` as an offline-dev fallback only.

### Secrets policy (Phase 2.5)

**`public/config.json` must never contain secrets.** The file is served as a
plain static asset; every byte is public. Specifically:

- `msal.clientId` is a public identifier by OAuth 2.0 design — it is safe to
  commit.
- `msal.tenantId` is a public identifier — it is safe to commit.
- Anything with entropy (API keys, signing material, DSNs that embed a
  secret, connection strings) belongs in pipeline variables or Key Vault, and
  is injected into `config.json` at deploy time (or served server-side by the
  BFF in Phase 9).

The repo enforces this via two complementary scanners that run on every
commit through `lint-staged` + `.husky/pre-commit`:

| Scanner | Scope | Wired in |
|---|---|---|
| `eslint-plugin-no-secrets` | TS / HTML files; entropy-based (`tolerance: 4.5`) | Phase 1.6 |
| `secretlint` + `preset-recommend` | Every staged file; format-specific detectors (AWS, GCP, GitHub, Slack, Stripe, OpenAI, Anthropic, RSA PEM, etc.) | Phase 2.5 |

Run the full secrets sweep locally any time with:

```bash
npm run secrets:check
```

Report a false positive via the `.secretlintignore` file rather than adjusting
the rule tolerance.

---

## Phase status

Refer to [`../../../../Docs/Implementation/UI-Foundation-TODO.md`](../../../../Docs/Implementation/UI-Foundation-TODO.md)
for the current phase + checklist.

- **Phase 0** — Decision gate + workspace scaffold: ✅ in progress
- **Phase 1** — Stabilization (modern APIs, perm hydration, error-UX ownership, ESLint+Husky): pending
- **Phase 2** — Security + runtime config + CSP + session UX: pending
- **Phase 3** — Observability (App Insights + web vitals + correlation): pending
- **Phase 4** — Testing foundation (Vitest + Playwright + arch tests): pending
- **Phase 5+** — see TODO
