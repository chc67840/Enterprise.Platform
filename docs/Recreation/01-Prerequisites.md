# 01 — Prerequisites

> Install everything in this doc **before** moving to `02-Solution-And-Scaffolding.md`.
> Each tool has a verification command — if a tool's verify fails, fix it
> before continuing.

## Hardware / OS targets

| Platform | Supported | Notes |
|---|---|---|
| Windows 11 | ✅ | Primary dev target. WDAC may interfere with `dotnet run` (use VS 2026 F5 — see `feedback_wdac_blocks_runtime` in repo memory) |
| macOS 14+ (Apple Silicon or Intel) | ✅ | Use Brew for installs |
| Ubuntu 22.04+ / WSL2 | ✅ | Use APT + dotnet install script |
| Disk | 10 GB free minimum | npm + .NET SDK + SQL Server eat ~6 GB |
| Memory | 16 GB recommended | 8 GB works but tight when running BFF + API + Worker + SQL Server + ng serve |

---

## 1. .NET SDK 10 (10.0.100, allowPrerelease)

The repo's `global.json` pins this exact SDK. Anything older will fail at restore.

### Install

| OS | Command |
|---|---|
| Windows (winget) | `winget install --id Microsoft.DotNet.SDK.Preview` |
| macOS (Brew) | `brew install --cask dotnet-sdk` (then verify version — may need to grab installer from microsoft.com if Brew lags) |
| Linux / WSL | `curl -sSL https://dot.net/v1/dotnet-install.sh \| bash /dev/stdin --version 10.0.100 --install-dir ~/.dotnet` then add `~/.dotnet` to `PATH` |
| Direct | https://dotnet.microsoft.com/download/dotnet/10.0 |

### Verify

```bash
dotnet --version            # → 10.0.100 (or higher patch)
dotnet --list-sdks          # → must include 10.0.x
dotnet --list-runtimes      # → must include Microsoft.AspNetCore.App 10.x AND Microsoft.NETCore.App 10.x
```

### Common gotchas

- **Multiple SDKs installed?** `global.json` will pick `10.0.100` exactly (rolls
  forward to latest 10.0.x feature). If `dotnet --version` reports an older
  number, `cd` out of any directory containing a stricter `global.json`.
- **WDAC blocking on Windows?** If `dotnet run` throws
  `0x800711C7 — Application Control policy has blocked this file`, use VS
  2026 (Run → F5) instead. The signed launcher works around WDAC.
- **`dotnet.exe` missing after Windows update?** Re-install from winget
  (memory entry: `feedback_dotnet_sdk_vanished.md`).

---

## 2. Global .NET tools

### dotnet-ef (EF Core CLI)

```bash
dotnet tool install --global dotnet-ef --version 10.0.0
```

Verify:

```bash
dotnet ef --version          # → 10.0.0
```

### dotnet user-secrets

Comes built-in with the SDK; no separate install. Verify:

```bash
dotnet user-secrets --help   # → shows the help text
```

---

## 3. Node.js + npm

### Required versions

- **Node.js >= 22.0.0** (LTS as of Apr 2026)
- **npm >= 11.8.0**

The Angular CLI v21 + `@angular/build` builder require these minimums.

### Install

| OS | Command |
|---|---|
| Windows (winget) | `winget install OpenJS.NodeJS.LTS` |
| macOS / Linux | use **nvm** (recommended for multi-version): `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh \| bash`, then `nvm install 22 && nvm use 22` |
| Direct | https://nodejs.org/ |

### Verify

```bash
node --version    # → v22.x or higher
npm --version     # → 11.8.0 or higher
```

### Common gotchas

- **`npm install` complains about peer-deps?** This repo uses
  `--legacy-peer-deps` for npm installs because Storybook/Angular peer ranges
  don't always agree. Document'd in `feedback_ui_phase2_gotchas`.
- **Old npm shipped with Node?** `npm install -g npm@latest` to bump.

---

## 4. Angular CLI 21 (optional global install)

Not strictly required — `npx ng …` works through the workspace's local
install. But a global install lets you run `ng new` and `ng version` outside
a project.

```bash
npm install -g @angular/cli@21
ng version    # → Angular CLI: 21.x.x; Angular: 21.x.x
```

---

## 5. SQL Server (LocalDB or Developer Edition)

The default connection string targets `Data Source=localhost`. You need a
SQL Server instance reachable on that path.

### Install

| OS | Recommendation |
|---|---|
| Windows | **SQL Server 2022 Developer Edition** (free, full features) — https://www.microsoft.com/en-us/sql-server/sql-server-downloads. Or **LocalDB** (lighter): comes with Visual Studio. |
| macOS / Linux | **Docker** is the easiest path: see below |
| Cloud | Azure SQL Database (uses same EF migrations) |

### Docker path (any OS)

```bash
docker run -d --name sqlserver \
  -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=<YourStrong!Pass123>" \
  -p 1433:1433 \
  mcr.microsoft.com/mssql/server:2022-latest
```

Then change `appsettings.Development.json` connection string to:
`Data Source=localhost,1433;User ID=sa;Password=<YourStrong!Pass123>;...`

### Verify

```bash
# Windows (LocalDB)
sqllocaldb info MSSQLLocalDB     # → "Auto-create" + state Running

# Any OS (sqlcmd)
sqlcmd -S localhost -U sa -P '<YourStrong!Pass123>' -Q "SELECT @@VERSION"
# → returns "Microsoft SQL Server 2022 ..."
```

`sqlcmd` install:
- Windows: bundled with SQL Server tools, OR `winget install Microsoft.Sqlcmd`
- macOS: `brew install sqlcmd`
- Linux: `apt install mssql-tools`

---

## 6. Git

Pre-installed on macOS/Linux. Windows: `winget install Git.Git`.

```bash
git --version    # → git version 2.40 or higher
```

---

## 7. Visual Studio 2026 (Windows) — recommended for the BFF host

The repo's BFF (`Enterprise.Platform.Web.UI`) hits a WDAC-blocking issue with
plain `dotnet run` on Windows. Visual Studio's signed launcher works around
this.

- **Download:** https://visualstudio.microsoft.com/vs/preview/ (Community
  edition is free, supports everything you need)
- **Workloads to install:** *ASP.NET and web development*, *.NET desktop
  development* (for analyzers / diagnostics), *Data storage and processing*
  (for SQL Server tooling)

VS Code or Rider work too — but if you're on Windows + WDAC, VS is the path
of least resistance for running the BFF.

---

## 8. Azure account + Entra tenant (for OIDC)

Required for the live Web.UI authentication flow. Without this, the BFF
boots in cookie-only mode (every protected endpoint returns 401).

- **Free Azure subscription:** https://azure.microsoft.com/free/
- **Entra tenant:** every Azure subscription comes with a default tenant. You
  can also use your work tenant.
- **App Registration provisioning:** detailed in
  [`Docs/Security/bff-oidc-setup.md`](../Security/bff-oidc-setup.md).

---

## 9. Optional but recommended

| Tool | Why | Install |
|---|---|---|
| **Azure CLI** | Manages App Registrations from the command line, faster than the portal for repeated tasks | `winget install Microsoft.AzureCLI` / `brew install azure-cli` |
| **`gh` (GitHub CLI)** | Faster PR + issue ops if the repo is on GitHub | `winget install GitHub.cli` |
| **`jq`** | JSON inspection for curl smoke-test responses | `winget install jqlang.jq` / `brew install jq` |
| **Postman** or **Bruno** | XHR / OIDC flow inspection. Bruno is open-source. | Either tool's site |

---

## 10. Angular dev cycle workspace prep

These don't install anything new but ensure the npm install will succeed.

```bash
# Configure npm to skip optional Win32 binaries if on macOS/Linux (avoids spurious install errors)
npm config set ignore-optional false

# Verify global install path is on PATH (symptoms: `ng` not found after `npm install -g`)
npm prefix -g
# → output should be on your PATH (e.g. /usr/local/bin or %APPDATA%\npm)
```

---

## Final verification — run all checks at once

Copy-paste this whole block. If any line fails, fix the corresponding tool above
before moving on:

```bash
echo "=== .NET SDK ==="
dotnet --version
dotnet --list-sdks | grep "10\."

echo "=== EF tooling ==="
dotnet ef --version

echo "=== Node + npm ==="
node --version
npm --version

echo "=== Git ==="
git --version

echo "=== SQL Server reachable ==="
# Adjust to your SQL Server connection
sqlcmd -S localhost -E -Q "SELECT 'ok' AS status" 2>&1 || echo "WARN: SQL Server not reachable on default instance — set up before running migrations"

echo "=== Optional: Angular CLI (skip if not installed globally) ==="
ng version 2>/dev/null || echo "(npx ng will be used inside the project)"
```

Expected: each major tool prints its version. SQL Server may legitimately
warn if you set up via Docker on a non-default port — that's OK as long as
you'll point `appsettings` at the correct `Data Source`.

---

**Next:** [`02-Solution-And-Scaffolding.md`](02-Solution-And-Scaffolding.md) —
create the solution, add all projects, wire references.
