# 03 — Packages + Coding Standards

> **Output of this doc.** Repo-root `Directory.Build.props`, `Directory.Packages.props`,
> `nuget.config`, `global.json` in place. Every project picks up the conventions
> automatically. NPM packages locked in the SPA's `package.json`. Naming
> conventions documented + enforced.

## 1. `global.json` (repo root)

Pins the .NET SDK version so everyone on the team builds with the exact same
toolchain.

```json
{
  "sdk": {
    "version": "10.0.100",
    "rollForward": "latestFeature",
    "allowPrerelease": true
  }
}
```

- **`version: 10.0.100`** — exact SDK base.
- **`rollForward: latestFeature`** — accept any 10.0.x feature update; reject 10.1+.
- **`allowPrerelease: true`** — .NET 10 was preview at the time of authoring.
  Flip to `false` once GA shipped.

## 2. `nuget.config` (repo root)

Single feed (nuget.org), explicit package source mapping (locks down the
"where can a package come from" attack surface).

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
  <packageSourceMapping>
    <packageSource key="nuget.org">
      <package pattern="*" />
    </packageSource>
  </packageSourceMapping>
</configuration>
```

If a private feed (Azure Artifacts, MyGet) ever gets added, narrow the
`pattern="*"` mapping per-source. Right now it's a single source so
wildcards are fine.

## 3. `Directory.Build.props` (repo root)

Applies to **every** project under the repo automatically — set common
MSBuild properties once.

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <AnalysisLevel>latest-recommended</AnalysisLevel>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    <NuGetAudit>true</NuGetAudit>
    <NuGetAuditLevel>moderate</NuGetAuditLevel>
    <NuGetAuditMode>direct</NuGetAuditMode>

    <!--
      CA1716: flags identifiers that clash with reserved keywords in VB.NET / F# (e.g. "Error", "Shared").
      The platform is C#-only and has no public-library publishing story, so the VB-interop risk does
      not apply. We intentionally use names like `Error` (result-pattern) and the `Shared` project
      name that the architecture mandates.
    -->
    <NoWarn>$(NoWarn);CA1716</NoWarn>
  </PropertyGroup>
</Project>
```

| Property | Value | Why |
|---|---|---|
| `TargetFramework` | `net10.0` | Single TFM across the repo. Per-project overrides are possible but unused today. |
| `Nullable` | `enable` | Strict null checking. Forces `?` annotations. |
| `ImplicitUsings` | `enable` | Standard System.* usings auto-included. |
| `TreatWarningsAsErrors` | `true` | No warnings ship to main. CA-codes become hard fails. |
| `AnalysisLevel` | `latest-recommended` | Picks up newest analyzer rules at each .NET release. |
| `EnforceCodeStyleInBuild` | `true` | `.editorconfig` style violations also fail the build. |
| `NuGetAudit` + `Mode: direct` + `Level: moderate` | enabled | `dotnet restore` warns on direct deps with known CVEs. |
| `NoWarn: CA1716` | suppressed | VB-interop irrelevant; we use `Error` / `Shared` deliberately. |

## 4. `Directory.Packages.props` (repo root)

Central Package Management — every NuGet version lives here, ONCE. Project
csproj `<PackageReference>` entries carry NO `Version` attribute.

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <!-- EF Core -->
    <PackageVersion Include="Microsoft.EntityFrameworkCore" Version="10.0.0" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.0.0" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.Tools" Version="10.0.0" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.0" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.InMemory" Version="10.0.0" />

    <!-- Identity & Auth -->
    <PackageVersion Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="10.0.0" />
    <PackageVersion Include="Microsoft.AspNetCore.Authentication.OpenIdConnect" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Identity.Web" Version="3.14.1" />

    <!-- Validation -->
    <PackageVersion Include="FluentValidation" Version="11.11.0" />
    <PackageVersion Include="FluentValidation.DependencyInjectionExtensions" Version="11.11.0" />

    <!-- Microsoft.Extensions abstractions (consumed by Application for DI, logging,
         caching, and configuration — all abstractions-only, no runtime impl pulled) -->
    <PackageVersion Include="Microsoft.Extensions.DependencyInjection.Abstractions" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Extensions.Logging.Abstractions" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Extensions.Logging" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Extensions.Caching.Abstractions" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Extensions.Configuration.Abstractions" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Extensions.Configuration" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Extensions.Configuration.Json" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Extensions.DependencyInjection" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Extensions.Options" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Extensions.Options.ConfigurationExtensions" Version="10.0.0" />

    <!-- Object Mapping (DtoGen emits Mapster TypeAdapterConfigs per D2) -->
    <PackageVersion Include="Mapster" Version="7.4.0" />
    <PackageVersion Include="Mapster.DependencyInjection" Version="1.0.1" />

    <!-- Roslyn syntax parsing — consumed only by tools/Enterprise.Platform.DtoGen -->
    <PackageVersion Include="Microsoft.CodeAnalysis.CSharp" Version="4.12.0" />

    <!-- Resilience -->
    <PackageVersion Include="Microsoft.Extensions.Http.Resilience" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Extensions.Resilience" Version="10.0.0" />

    <!-- Hosting (for Worker Service template) -->
    <PackageVersion Include="Microsoft.Extensions.Hosting" Version="10.0.3" />

    <!-- Observability -->
    <PackageVersion Include="OpenTelemetry.Extensions.Hosting" Version="1.12.0" />
    <PackageVersion Include="OpenTelemetry.Instrumentation.AspNetCore" Version="1.12.0" />
    <PackageVersion Include="OpenTelemetry.Instrumentation.EntityFrameworkCore" Version="1.10.0-beta.1" />
    <PackageVersion Include="OpenTelemetry.Instrumentation.Http" Version="1.12.0" />
    <PackageVersion Include="OpenTelemetry.Instrumentation.SqlClient" Version="1.10.0-beta.1" />
    <PackageVersion Include="OpenTelemetry.Exporter.OpenTelemetryProtocol" Version="1.12.0" />

    <!-- Caching -->
    <PackageVersion Include="Microsoft.Extensions.Caching.StackExchangeRedis" Version="10.0.0" />

    <!-- API -->
    <PackageVersion Include="Asp.Versioning.Http" Version="8.1.0" />
    <PackageVersion Include="Swashbuckle.AspNetCore" Version="7.2.0" />
    <PackageVersion Include="Microsoft.AspNetCore.OpenApi" Version="10.0.3" />

    <!-- Azure -->
    <PackageVersion Include="Azure.Identity" Version="1.14.2" />
    <PackageVersion Include="Azure.Extensions.AspNetCore.Configuration.Secrets" Version="1.4.0" />
    <PackageVersion Include="Azure.Storage.Blobs" Version="12.23.0" />
    <PackageVersion Include="Microsoft.Extensions.Configuration.AzureAppConfiguration" Version="8.1.0" />

    <!-- Background Jobs -->
    <PackageVersion Include="Hangfire.Core" Version="1.8.17" />
    <PackageVersion Include="Hangfire.SqlServer" Version="1.8.17" />
    <PackageVersion Include="Hangfire.AspNetCore" Version="1.8.17" />

    <!-- Data Protection (Azure Key Vault via modern Azure.Extensions package) -->
    <PackageVersion Include="Azure.Extensions.AspNetCore.DataProtection.Keys" Version="1.5.1" />
    <PackageVersion Include="Azure.Security.KeyVault.Keys" Version="4.7.0" />
    <PackageVersion Include="Azure.Security.KeyVault.Secrets" Version="4.7.0" />

    <!-- Logging -->
    <PackageVersion Include="Serilog.AspNetCore" Version="9.0.0" />
    <PackageVersion Include="Serilog.Sinks.Console" Version="6.0.0" />
    <PackageVersion Include="Serilog.Sinks.Seq" Version="9.0.0" />
    <PackageVersion Include="Serilog.Enrichers.Environment" Version="3.0.1" />
    <PackageVersion Include="Serilog.Enrichers.Thread" Version="4.0.0" />
  </ItemGroup>
</Project>
```

> The `<!-- Testing -->` group from the actual repo is omitted here — test
> projects are out of scope.

## 5. Per-project NuGet `<PackageReference>` matrix

After `Directory.Packages.props` is in place, edit each `csproj` to declare
the versionless package references it actually consumes.

### 5.1 `Enterprise.Platform.Shared.csproj`

Pure constants library. **Zero NuGet refs.**

### 5.2 `Enterprise.Platform.Contracts.csproj`

Settings POCOs need binding extensions only.

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.Extensions.Options.ConfigurationExtensions" />
</ItemGroup>
```

### 5.3 `Enterprise.Platform.Domain.csproj`

**Zero NuGet refs.** Domain stays pure — no framework dependencies.

### 5.4 `Enterprise.Platform.Application.csproj`

Abstractions only — no runtime EF Core, no MS.AspNetCore.

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.Extensions.DependencyInjection.Abstractions" />
  <PackageReference Include="Microsoft.Extensions.Logging.Abstractions" />
  <PackageReference Include="Microsoft.Extensions.Caching.Abstractions" />
  <PackageReference Include="Microsoft.Extensions.Configuration.Abstractions" />
  <PackageReference Include="Microsoft.Extensions.Options" />
  <PackageReference Include="FluentValidation" />
  <PackageReference Include="FluentValidation.DependencyInjectionExtensions" />
  <PackageReference Include="Mapster" />
</ItemGroup>
```

### 5.5 `Enterprise.Platform.Infrastructure.csproj`

The big one — implements every Application abstraction.

```xml
<ItemGroup>
  <!-- EF Core -->
  <PackageReference Include="Microsoft.EntityFrameworkCore" />
  <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" />
  <PackageReference Include="Microsoft.EntityFrameworkCore.Design" />
  <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" />

  <!-- Logging + DI -->
  <PackageReference Include="Microsoft.Extensions.Configuration" />
  <PackageReference Include="Microsoft.Extensions.Configuration.Json" />
  <PackageReference Include="Microsoft.Extensions.DependencyInjection" />
  <PackageReference Include="Microsoft.Extensions.Logging" />
  <PackageReference Include="Microsoft.Extensions.Hosting" />
  <PackageReference Include="Microsoft.Extensions.Caching.StackExchangeRedis" />
  <PackageReference Include="Microsoft.Extensions.Options.ConfigurationExtensions" />

  <!-- Resilience -->
  <PackageReference Include="Microsoft.Extensions.Http.Resilience" />
  <PackageReference Include="Microsoft.Extensions.Resilience" />

  <!-- Mapping -->
  <PackageReference Include="Mapster.DependencyInjection" />

  <!-- Logging — Serilog composition shared across hosts -->
  <PackageReference Include="Serilog.AspNetCore" />
  <PackageReference Include="Serilog.Sinks.Console" />
  <PackageReference Include="Serilog.Sinks.Seq" />
  <PackageReference Include="Serilog.Enrichers.Environment" />
  <PackageReference Include="Serilog.Enrichers.Thread" />

  <!-- Observability — OpenTelemetry -->
  <PackageReference Include="OpenTelemetry.Extensions.Hosting" />
  <PackageReference Include="OpenTelemetry.Instrumentation.AspNetCore" />
  <PackageReference Include="OpenTelemetry.Instrumentation.EntityFrameworkCore" />
  <PackageReference Include="OpenTelemetry.Instrumentation.Http" />
  <PackageReference Include="OpenTelemetry.Instrumentation.SqlClient" />
  <PackageReference Include="OpenTelemetry.Exporter.OpenTelemetryProtocol" />

  <!-- Identity (token validation only — Microsoft.Identity.Web is API-side) -->
  <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" />

  <!-- Background jobs (planned — Hangfire) -->
  <PackageReference Include="Hangfire.Core" />
  <PackageReference Include="Hangfire.SqlServer" />

  <!-- Azure adapters -->
  <PackageReference Include="Azure.Identity" />
  <PackageReference Include="Azure.Storage.Blobs" />
  <PackageReference Include="Azure.Extensions.AspNetCore.Configuration.Secrets" />
  <PackageReference Include="Microsoft.Extensions.Configuration.AzureAppConfiguration" />

  <!-- Data Protection (Azure Key Vault) -->
  <PackageReference Include="Azure.Extensions.AspNetCore.DataProtection.Keys" />
  <PackageReference Include="Azure.Security.KeyVault.Keys" />
  <PackageReference Include="Azure.Security.KeyVault.Secrets" />
</ItemGroup>
```

### 5.6 `Enterprise.Platform.Api.csproj`

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.Identity.Web" />
  <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" />
  <PackageReference Include="Asp.Versioning.Http" />
  <PackageReference Include="Microsoft.AspNetCore.OpenApi" />
  <PackageReference Include="Swashbuckle.AspNetCore" />
  <PackageReference Include="Microsoft.EntityFrameworkCore.Tools" />
  <PackageReference Include="Hangfire.AspNetCore" />
  <PackageReference Include="Serilog.AspNetCore" />
</ItemGroup>
```

### 5.7 `Enterprise.Platform.Worker.csproj`

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.Extensions.Hosting" />
  <PackageReference Include="Hangfire.Core" />
  <PackageReference Include="Hangfire.SqlServer" />
  <PackageReference Include="Serilog.AspNetCore" />
</ItemGroup>
```

### 5.8 `Enterprise.Platform.Web.UI.csproj`

```xml
<PropertyGroup>
  <UserSecretsId>6a637fa3-a1ca-4d37-83ce-c4a2d3fed289</UserSecretsId>
</PropertyGroup>

<ItemGroup>
  <PackageReference Include="Microsoft.AspNetCore.Authentication.OpenIdConnect" />
  <PackageReference Include="Serilog.AspNetCore" />
</ItemGroup>
```

> The `UserSecretsId` is per-environment — generate a fresh one with
> `dotnet user-secrets init` inside this project.

### 5.9 `Enterprise.Platform.DtoGen.csproj`

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.CodeAnalysis.CSharp" />
</ItemGroup>
```

### 5.10 Verify NuGet restore

```bash
cd <repo-root>
dotnet restore
# Expected: every project resolves; NO "Version conflict" or "missing version
# attribute" errors. CPM means versions ALL come from Directory.Packages.props.
```

## 6. NPM packages (SPA — `src/UI/Enterprise.Platform.Web.UI/ClientApp/`)

The full canonical `package.json` (post-Phase-9 — MSAL removed):

### 6.1 Engines

```json
"engines": {
  "node": ">=22.0.0",
  "npm": ">=10.0.0"
}
```

### 6.2 Production dependencies (Angular 21 + PrimeNG 21 + NGRX Signals 21)

```json
"dependencies": {
  "@angular-architects/ngrx-toolkit": "^21.0.1",
  "@angular/animations": "^21.2.4",
  "@angular/cdk": "^21.2.2",
  "@angular/common": "^21.2.0",
  "@angular/compiler": "^21.2.0",
  "@angular/core": "^21.2.0",
  "@angular/forms": "^21.2.0",
  "@angular/platform-browser": "^21.2.0",
  "@angular/router": "^21.2.0",
  "@microsoft/applicationinsights-web": "^3.4.1",
  "@ngrx/operators": "^21.0.1",
  "@ngrx/signals": "^21.0.1",
  "@primeng/themes": "^21.0.4",
  "chart.js": "^4.5.1",
  "date-fns": "^4.1.0",
  "focus-trap": "^8.0.1",
  "primeicons": "^7.0.0",
  "primeng": "^21.1.3",
  "rxjs": "~7.8.0",
  "tslib": "^2.3.0",
  "web-vitals": "^5.2.0",
  "zod": "^4.3.6"
}
```

### 6.3 Dev dependencies (build, lint, test, storybook, secret-scan)

```json
"devDependencies": {
  "@angular-devkit/build-angular": "^21.2.7",
  "@angular-eslint/builder": "^21.3.1",
  "@angular-eslint/eslint-plugin": "^21.3.1",
  "@angular-eslint/eslint-plugin-template": "^21.3.1",
  "@angular-eslint/schematics": "^21.3.1",
  "@angular-eslint/template-parser": "^21.3.1",
  "@angular/build": "^21.2.2",
  "@angular/cli": "^21.2.2",
  "@angular/compiler-cli": "^21.2.0",
  "@axe-core/playwright": "^4.11.2",
  "@commitlint/cli": "^19.8.1",
  "@commitlint/config-conventional": "^19.8.1",
  "@eslint/js": "^10.0.1",
  "@microsoft/microsoft-graph-types": "^2.43.1",
  "@playwright/test": "^1.59.1",
  "@secretlint/secretlint-rule-preset-recommend": "^12.1.0",
  "@storybook/addon-a11y": "^10.3.5",
  "@storybook/addon-docs": "^10.3.5",
  "@storybook/angular": "^10.3.5",
  "@storybook/test-runner": "^0.24.3",
  "@tailwindcss/postcss": "^4.2.1",
  "@tailwindcss/vite": "^4.2.1",
  "@vitest/coverage-v8": "^4.1.4",
  "dependency-cruiser": "^17.3.10",
  "eslint": "^9.39.4",
  "eslint-config-prettier": "^10.1.8",
  "eslint-plugin-import": "^2.32.0",
  "eslint-plugin-no-secrets": "^2.3.3",
  "eslint-plugin-security": "^3.0.1",
  "globals": "^16.5.0",
  "husky": "^9.1.7",
  "jsdom": "^28.0.0",
  "lint-staged": "^16.4.0",
  "postcss-loader": "^8.2.1",
  "prettier": "^3.8.1",
  "secretlint": "^12.1.0",
  "source-map-explorer": "^2.5.3",
  "storybook": "^10.3.5",
  "tailwindcss": "^4.2.1",
  "typescript": "~5.9.2",
  "typescript-eslint": "^8.58.2",
  "vitest": "^4.0.8"
}
```

### 6.4 Scripts (`npm run …`)

```json
"scripts": {
  "ng": "ng",
  "start": "ng serve",
  "build": "ng build",
  "build:dev": "ng build --configuration development",
  "build:prod": "ng build --configuration production",
  "watch": "ng build --watch --configuration development",
  "test": "ng test",
  "lint": "eslint \"src/**/*.{ts,html}\"",
  "lint:fix": "eslint \"src/**/*.{ts,html}\" --fix",
  "format": "prettier --write \"src/**/*.{ts,html,css,json,md}\"",
  "format:check": "prettier --check \"src/**/*.{ts,html,css,json,md}\"",
  "analyze": "ng build --configuration production --stats-json && source-map-explorer dist/enterprise-platform-client/browser/*.js",
  "bundle:stats": "ng build --configuration production --stats-json",
  "bundle:check": "npm run bundle:stats && node scripts/bundle-check.mjs",
  "bundle:check:only": "node scripts/bundle-check.mjs",
  "secrets:check": "secretlint --secretlintignore .secretlintignore --maskSecrets \"src/**/*\" \"public/**/*\" \"*.{json,js,md}\"",
  "arch:check": "depcruise --config .dependency-cruiser.cjs --output-type err src",
  "test:unit": "vitest run",
  "test:unit:watch": "vitest",
  "test:unit:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "test:e2e:install": "playwright install chromium",
  "storybook": "ng run enterprise-platform-client:storybook",
  "build-storybook": "ng run enterprise-platform-client:build-storybook",
  "storybook:test": "test-storybook",
  "prepare": "husky"
}
```

### 6.5 Install + verify

```bash
cd src/UI/Enterprise.Platform.Web.UI/ClientApp
npm install --legacy-peer-deps
# `--legacy-peer-deps` is necessary because Storybook 10 + Angular 21 peer
# ranges don't align without help. See feedback_ui_phase2_gotchas memory.

npm run lint           # 0 warnings
npm run arch:check     # 0 violations
npm run build          # builds clean
```

## 7. Coding standards (locked-in)

These are enforced by analyzers + reviewers. Not negotiable for new code.

### 7.1 C# conventions

| Concern | Rule | Why |
|---|---|---|
| Namespaces | File-scoped (`namespace Foo;`) | Saves indentation, modern style |
| Nullable | Enabled, no warning suppressions in production code | Prevents NREs |
| Class default | `sealed` unless inheritance is required | JIT optimization + intent |
| DI | Primary-constructor parameters (`public sealed class Foo(IDep dep) : ...`) | Less boilerplate |
| Logging | `[LoggerMessage]` source generators ONLY (CA1848) | Zero-allocation logging |
| Settings POCOs | `*Settings` suffix; bound via `AddValidatedOptions<T>` | Fail-fast on misconfig |
| DI extensions | `*Setup` suffix; `IServiceCollection` extension methods | Composition root readability |
| Middleware | `*Middleware` + co-located `UseXxx` extension | Discoverable |
| Endpoints | `*Endpoints` (plural for multiple, singular for one) | Standard ASP.NET pattern |
| Metrics | `*Metrics` class wrapping a `Meter` + `Counter`/`Histogram` | OTel idiom |
| Records | Use for immutable DTOs, value objects, JSON contracts | Saves boilerplate |
| async | `ConfigureAwait(false)` in library code; not required in app code | Prevents deadlocks in older sync contexts |
| Disposal | `using var` for locals; `IDisposable.Dispose` for owned services | Prevents leaks |

### 7.2 Folder placement

| File type | Folder |
|---|---|
| Settings POCOs | `Configuration/` (BFF) or `Contracts/Settings/` (shared) |
| DI extensions | `Setup/` (BFF) or `Configuration/` (API — historical Api convention) |
| Middleware | `Middleware/` |
| Endpoint mapping | `Endpoints/` |
| DI services | `Services/<area>/` |
| Health check probes | `Services/HealthChecks/` |
| Metrics | `Observability/` |
| Constants | `Constants/` (Shared project) or near consumers |
| JSON DTOs (controllers) | `Controllers/Models/` |

### 7.3 Logger event-id ranges (BFF)

Documented in [`project_webui_structure`](../../C:/Users/hkgou/.claude/projects/...) memory:

- 1001–1006 — `AuthController`
- 2001–2006 — `TokenRefreshService`
- 4001–4003 — `ProxyController`
- 5001–5005 — `GraphUserProfileService`

API + Worker maintain their own ranges (document inside each project's
`Common/LogMessages.cs` if present).

### 7.4 Angular conventions

| Concern | Rule |
|---|---|
| Components | Standalone, `OnPush`, `inject()` (no constructor injection) |
| State | NGRX Signals `signalStore` per feature; no NgRx Store |
| Services | `@Injectable({ providedIn: 'root' })` for cross-feature; route-scoped for feature-internal |
| HTTP | Functional interceptors only; no class interceptors |
| Tier model | `core` ≺ `shared` ≺ `layouts` ≺ `features` (enforced by dependency-cruiser) |
| Test | Vitest for unit; Playwright for e2e; Storybook for component dev |
| Imports | Use `@core/*`, `@shared/*`, `@features/*`, `@config/*`, `@env/*` aliases |

## 8. .editorconfig (repo root)

The standard ASP.NET Core `.editorconfig` covers most rules. Specific
overrides this repo applies:

```ini
# .editorconfig (excerpt)
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 4
insert_final_newline = true
trim_trailing_whitespace = true

[*.{json,yml,yaml,md}]
indent_size = 2

[*.cs]
csharp_style_namespace_declarations = file_scoped:warning
csharp_prefer_braces = true:warning
csharp_using_directive_placement = outside_namespace:warning
dotnet_style_qualification_for_field = false:warning
dotnet_style_qualification_for_property = false:warning
```

## 9. Pre-commit hooks (Husky)

The SPA's `package.json` runs `husky` on `npm install` (`"prepare": "husky"`).
Husky hooks live under `.husky/`:

- `pre-commit` — runs `lint-staged` (eslint + prettier on staged files only)
- `commit-msg` — runs `commitlint` (enforces conventional commits)

Set up after the first `npm install`:

```bash
cd src/UI/Enterprise.Platform.Web.UI/ClientApp
npx husky init
echo "npx lint-staged" > .husky/pre-commit
echo "npx --no -- commitlint --edit \$1" > .husky/commit-msg
```

`.lintstagedrc.json`:

```json
{
  "*.{ts,html}": ["eslint --fix"],
  "*.{ts,html,css,json,md}": ["prettier --write"]
}
```

`commitlint.config.js`:

```js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

## 10. Verify everything

```bash
# Repo root
dotnet restore
dotnet build         # 0 warnings / 0 errors

# SPA
cd src/UI/Enterprise.Platform.Web.UI/ClientApp
npm install --legacy-peer-deps
npm run lint
npm run arch:check
npm run build
```

All green? Move on to settings.

---

**Next:** [`04-Configuration-And-Settings.md`](04-Configuration-And-Settings.md) —
populate the `Settings/` folder, wire `AddValidatedOptions<T>`, layer
appsettings + env-vars + user-secrets + Key Vault.
