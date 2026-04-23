# 04 — Configuration + Settings POCOs

> **Output of this doc.** Every settings POCO created, every section bound,
> every validator wired. `appsettings.json` layering documented (base →
> environment → env vars → user-secrets → Azure Key Vault). Hosts boot
> with `ValidateOnStart` so misconfig fails loud at start, not at first request.

## 1. Configuration source layering (most-specific wins)

ASP.NET reads sources in the order they're added. Later sources override earlier:

```
appsettings.json
  ↓
appsettings.{Environment}.json     (Development / Staging / Production)
  ↓
Environment variables               (PREFIX__SECTION__KEY syntax)
  ↓
dotnet user-secrets                 (Development only — local dev secrets)
  ↓
Azure Key Vault                     (Staging/Prod — production secrets)
```

`Program.cs` of every host should establish this order explicitly:

```csharp
builder.Configuration
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json",
                 optional: true, reloadOnChange: true)
    .AddEnvironmentVariables();

if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddUserSecrets<Program>();
}
else if (!string.IsNullOrWhiteSpace(builder.Configuration["KeyVault:Uri"]))
{
    var keyVaultUri = new Uri(builder.Configuration["KeyVault:Uri"]!);
    builder.Configuration.AddAzureKeyVault(keyVaultUri, new DefaultAzureCredential());
}
```

## 2. Settings POCO conventions

Each settings class lives in `src/Contracts/Enterprise.Platform.Contracts/Settings/`
(when shared across hosts) OR in the host's own `Configuration/` folder (when
host-specific, e.g. BFF's `AzureAdSettings`).

### 2.1 Required surface

```csharp
public sealed class XxxSettings
{
    /// <summary>Configuration section name — bound via Get<XxxSettings>(SectionName).</summary>
    public const string SectionName = "Xxx";

    // properties with sensible defaults so a missing config section still gives
    // an instance you can inspect at startup:
    public string Foo { get; set; } = "default-value";
    public int Bar { get; set; } = 42;
}
```

### 2.2 Validation pattern

For non-trivial settings, attach a validator. Either via DataAnnotations on the
properties OR a custom `IValidateOptions<T>` implementation:

```csharp
public sealed class XxxSettingsValidator : IValidateOptions<XxxSettings>
{
    public ValidateOptionsResult Validate(string? name, XxxSettings options)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(options.Foo))
            errors.Add("Xxx:Foo must be set.");

        if (options.Bar <= 0)
            errors.Add($"Xxx:Bar must be positive (got {options.Bar}).");

        return errors.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(errors);
    }
}
```

### 2.3 Binding helper — `AddValidatedOptions<T>`

In `Infrastructure/Configuration/ValidatedOptionsExtensions.cs`:

```csharp
namespace Enterprise.Platform.Infrastructure.Configuration;

public static class ValidatedOptionsExtensions
{
    /// <summary>
    /// Binds + validates + ValidateOnStart in one call. The hosts call this
    /// instead of raw <c>services.Configure</c> so misconfig surfaces at boot
    /// rather than at first IOptions resolution (which may never happen for
    /// rarely-used settings).
    /// </summary>
    public static IServiceCollection AddValidatedOptions<TOptions>(
        this IServiceCollection services,
        IConfiguration configuration,
        string sectionName)
        where TOptions : class
    {
        services.AddOptions<TOptions>()
            .Bind(configuration.GetSection(sectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        return services;
    }
}
```

For settings that have a custom validator class, ALSO register it:

```csharp
services.AddSingleton<IValidateOptions<XxxSettings>, XxxSettingsValidator>();
services.AddValidatedOptions<XxxSettings>(configuration, XxxSettings.SectionName);
```

## 3. Shared settings POCOs (`Contracts/Settings/`)

Every settings file used by more than one host. **All bind via
`AddValidatedOptions<T>`** at host-startup time.

### 3.1 `ObservabilitySettings.cs`

```csharp
namespace Enterprise.Platform.Contracts.Settings;

public sealed class ObservabilitySettings
{
    public const string SectionName = "Observability";

    /// <summary>Service name in OTel + Serilog enrichers (e.g. enterprise-platform-api).</summary>
    public string ServiceName { get; set; } = "enterprise-platform";
    public string ServiceVersion { get; set; } = "0.0.0-dev";

    /// <summary>OTLP endpoint (gRPC). Empty → no exporter, console only.</summary>
    public string? OtelEndpoint { get; set; }

    /// <summary>Trace sampling ratio: 1.0 = sample all; 0 = sample none.</summary>
    public double SamplingRatio { get; set; } = 1.0;

    public bool EnableHttpInstrumentation { get; set; } = true;
    public bool EnableDatabaseInstrumentation { get; set; } = true;

    /// <summary>Serilog Seq sink endpoint. Empty → console only.</summary>
    public string? SeqEndpoint { get; set; }
}
```

### 3.2 `DatabaseSettings.cs`

Maps logical connection-name → provider/timeouts/replica flag.

```csharp
namespace Enterprise.Platform.Contracts.Settings;

public sealed class DatabaseSettings
{
    public const string SectionName = "DatabaseSettings";

    public string DefaultConnection { get; set; } = string.Empty;
    public Dictionary<string, ConnectionOptions> Connections { get; set; } = new();

    public sealed class ConnectionOptions
    {
        public string ConnectionStringName { get; set; } = string.Empty;
        public string Provider { get; set; } = "SqlServer";
        public int CommandTimeoutSeconds { get; set; } = 30;
        public bool IsReadReplica { get; set; }
        public bool EnableSensitiveDataLogging { get; set; }
        public bool EnableDetailedErrors { get; set; }
    }
}
```

### 3.3 `EntraIdSettings.cs` (Api host — JWT validation)

```csharp
namespace Enterprise.Platform.Contracts.Settings;

public sealed class EntraIdSettings
{
    public const string SectionName = "AzureAd";

    public bool Enabled { get; set; }
    public string Instance { get; set; } = "https://login.microsoftonline.com/";
    public string TenantId { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;

    /// <summary>aud claims this Api accepts.</summary>
    public List<string> Audiences { get; set; } = new();

    /// <summary>iss claims this Api accepts (covers v1 + v2 token shapes).</summary>
    public List<string> AllowedIssuers { get; set; } = new();

    /// <summary>scp claims required (e.g. ["access_as_user"]).</summary>
    public List<string> RequiredScopes { get; set; } = new();

    /// <summary>Token claim type that carries the Entra tenant id.</summary>
    public string TenantIdClaim { get; set; } = "tid";

    /// <summary>Entra tenant id → platform tenant Guid mapping.</summary>
    public Dictionary<string, Guid> PlatformTenantMapping { get; set; } = new();
}
```

### 3.4 Other shared settings (one-line summaries — full templates in repo)

| File | Section | Purpose |
|---|---|---|
| `EntraIdB2CSettings.cs` | `AzureAdB2C` | B2C-specific scope/policy/domain (deferred until B2C lifts) |
| `JwtSettings.cs` | `Jwt` | Dev fallback symmetric-key JWT (when both Entra schemes disabled) |
| `CorsSettings.cs` | `Cors` | AllowedOrigins, AllowedMethods, AllowedHeaders, ExposedHeaders, AllowCredentials, PreflightMaxAge |
| `CacheSettings.cs` | `Cache` | Provider (`InMemory` \| `Redis`), KeyPrefix, DefaultTtl, Redis connection |
| `MultiTenancySettings.cs` | `MultiTenancy` | IsolationMode (`SharedDatabase` \| `DatabasePerTenant`), ResolutionStrategy (`Claim` \| `Header` \| `Subdomain`), RequireResolvedTenant |
| `RateLimitSettings.cs` | `RateLimit` | GlobalPermitsPerWindow, PerTenantPermitsPerWindow, PerUserPermitsPerWindow, Window |
| `AzureSettings.cs` | `Azure` | KeyVaultUri, AppConfigEndpoint, BlobAccountUri (for adapters) |
| `SmtpSettings.cs` | `Smtp` | Host, Port, FromAddress, etc. |
| `AppSettings.cs` | `App` | Cross-cutting app metadata (DefaultLocale, DefaultTimezone, etc.) |

## 4. Host-specific settings (in `Configuration/` of each host)

### 4.1 Web.UI host — `Configuration/AzureAdSettings.cs`

Confidential-client OIDC settings (different from Api's `EntraIdSettings`).
**See doc 07 for full content** — this is the file we just refactored from
`AzureAdBffSettings.cs`.

Key fields: `Enabled`, `Instance`, `TenantId`, `ClientId`, `ClientSecret`,
`CallbackPath`, `SignedOutCallbackPath`, `ApiScope`, `SessionLifetime`.

### 4.2 Web.UI host — `Configuration/ProxySettings.cs`

```csharp
public sealed class ProxySettings
{
    public const string SectionName = "Proxy";

    public string ApiBaseUri { get; set; } = "http://localhost:5099/";
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(30);
    public bool AttachBearerToken { get; set; }
}
```

### 4.3 Web.UI host — `Configuration/SpaHostingSettings.cs`

```csharp
public sealed class SpaHostingSettings
{
    public const string SectionName = "SpaHosting";
    public string StaticRoot { get; set; } = string.Empty;
}
```

## 5. `appsettings.json` template per host

### 5.1 Api — `src/API/Enterprise.Platform.Api/appsettings.json`

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "EventShopperDb": "Data Source=localhost;Initial Catalog=EventShopperDb;Integrated Security=True;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=True;Application Name=Enterprise.Platform;Command Timeout=0"
  },
  "DatabaseSettings": {
    "DefaultConnection": "EventShopper",
    "Connections": {
      "EventShopper": {
        "ConnectionStringName": "EventShopperDb",
        "Provider": "SqlServer",
        "CommandTimeoutSeconds": 0,
        "IsReadReplica": false,
        "EnableSensitiveDataLogging": false,
        "EnableDetailedErrors": true
      }
    }
  },
  "AzureAd": {
    "Enabled": true,
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "<your-tenant-id>",
    "ClientId": "<your-spa-or-bff-client-id>",
    "Audiences": [
      "<your-spa-or-bff-client-id>",
      "api://<your-spa-or-bff-client-id>"
    ],
    "AllowedIssuers": [
      "https://login.microsoftonline.com/<your-tenant-id>/v2.0",
      "https://sts.windows.net/<your-tenant-id>/"
    ],
    "RequiredScopes": ["access_as_user"],
    "TenantIdClaim": "tid"
  },
  "Cors": {
    "AllowedOrigins": [],
    "AllowedMethods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "AllowedHeaders": [
      "Authorization", "Content-Type", "X-Correlation-ID", "X-Tenant-ID",
      "X-Requested-With", "X-Content-Type-Options", "X-XSRF-TOKEN",
      "X-API-Version", "X-Idempotency-Key", "If-Match"
    ],
    "ExposedHeaders": ["X-Correlation-ID", "ETag", "Location"],
    "AllowCredentials": true,
    "PreflightMaxAge": "00:10:00"
  },
  "MultiTenancy": {
    "IsolationMode": "SharedDatabase",
    "ResolutionStrategy": "Claim",
    "RequireResolvedTenant": false
  },
  "RateLimit": {
    "GlobalPermitsPerWindow": 1000,
    "PerTenantPermitsPerWindow": 300,
    "PerUserPermitsPerWindow": 120,
    "Window": "00:01:00"
  },
  "Cache": {
    "Provider": "InMemory",
    "KeyPrefix": "ep",
    "DefaultTtl": "00:05:00"
  },
  "Observability": {
    "ServiceName": "enterprise-platform-api",
    "ServiceVersion": "0.0.0-dev",
    "SamplingRatio": 1.0,
    "EnableHttpInstrumentation": true
  }
}
```

### 5.2 Web.UI — `src/UI/Enterprise.Platform.Web.UI/appsettings.Development.json`

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.AspNetCore.Authentication": "Information"
    }
  },
  "Cors": {
    "AllowedOrigins": [ "http://localhost:4200" ],
    "AllowCredentials": true
  },
  "Proxy": {
    "ApiBaseUri": "http://localhost:5044/api/",
    "Timeout": "00:00:30",
    "AttachBearerToken": true
  },
  "SpaHosting": {
    "StaticRoot": "ClientApp/dist/enterprise-platform-client/browser"
  },
  "AzureAd": {
    "Enabled": true,
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "<your-tenant-id>",
    "ClientId": "<your-bff-client-id>",
    "CallbackPath": "/signin-oidc",
    "SignedOutCallbackPath": "/signout-callback-oidc",
    "ApiScope": "api://<your-spa-or-bff-client-id>/access_as_user",
    "SessionLifetime": "08:00:00"
  },
  "Observability": {
    "ServiceName": "enterprise-platform-web-ui",
    "ServiceVersion": "0.0.0-dev",
    "SamplingRatio": 1.0
  }
}
```

### 5.3 Worker — `src/Batch/Enterprise.Platform.Worker/appsettings.json`

Inherits the Api's database + observability shape; adds job schedules:

```json
{
  "DatabaseSettings": { /* same as Api */ },
  "Observability": {
    "ServiceName": "enterprise-platform-worker",
    "ServiceVersion": "0.0.0-dev"
  },
  "Jobs": {
    "OutboxProcessor": { "PollIntervalSeconds": 10, "BatchSize": 100 },
    "CacheWarmup": { "RunAtStartup": true, "RecurrenceCron": "0 */15 * * * *" },
    "AuditRetention": { "RetentionDays": 2555, "RecurrenceCron": "0 0 3 * * *" }
  }
}
```

## 6. User-secrets (dev secrets — never commit)

Initialized once per project that needs secrets:

```bash
cd src/UI/Enterprise.Platform.Web.UI
dotnet user-secrets init
dotnet user-secrets set "AzureAd:ClientSecret" "<the value from Entra portal>"
dotnet user-secrets list   # sanity check
```

Stored under `%APPDATA%\Microsoft\UserSecrets\<UserSecretsId>\secrets.json`.
The `UserSecretsId` is in the csproj (auto-generated by `dotnet user-secrets init`).

The Api project typically does NOT need user-secrets (no client secrets — it
only validates JWTs from Entra).

## 7. Env-var binding (CI / staging / prod)

Any setting can be overridden via env var with double-underscore section delimiter:

```bash
# Override DatabaseSettings:Connections:EventShopper:ConnectionStringName
DATABASESETTINGS__CONNECTIONS__EVENTSHOPPER__CONNECTIONSTRINGNAME="EventShopperDbProd"

# Override AzureAd:ClientSecret (NEVER do this in source control)
AZUREAD__CLIENTSECRET="<production-secret>"
```

In production hosting (Azure App Service, Kubernetes, etc.), set these as
environment variables on the deployment unit.

## 8. Azure Key Vault (prod secrets)

```csharp
// Program.cs — non-Development branch
var keyVaultUri = builder.Configuration["KeyVault:Uri"];
if (!string.IsNullOrWhiteSpace(keyVaultUri))
{
    builder.Configuration.AddAzureKeyVault(
        new Uri(keyVaultUri),
        new DefaultAzureCredential());
}
```

`DefaultAzureCredential` walks: env vars → managed identity → Azure CLI →
VS sign-in. In Azure App Service / AKS, the managed identity covers it.

Naming convention in Key Vault: replace `:` with `--` (Key Vault doesn't
allow colons in secret names).

| Configuration key | Key Vault secret name |
|---|---|
| `AzureAd:ClientSecret` | `AzureAd--ClientSecret` |
| `ConnectionStrings:EventShopperDb` | `ConnectionStrings--EventShopperDb` |

## 9. Validators (Infrastructure/Configuration/Validation/)

Per-settings validator examples:

### 9.1 `DatabaseSettingsValidator.cs`

```csharp
internal sealed class DatabaseSettingsValidator : IValidateOptions<DatabaseSettings>
{
    public ValidateOptionsResult Validate(string? name, DatabaseSettings options)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(options.DefaultConnection))
            errors.Add("DatabaseSettings:DefaultConnection must be set.");

        if (options.Connections.Count == 0)
            errors.Add("DatabaseSettings:Connections must contain at least one entry.");

        foreach (var (key, conn) in options.Connections)
        {
            if (string.IsNullOrWhiteSpace(conn.ConnectionStringName))
                errors.Add($"DatabaseSettings:Connections:{key}:ConnectionStringName must be set.");
            if (string.IsNullOrWhiteSpace(conn.Provider))
                errors.Add($"DatabaseSettings:Connections:{key}:Provider must be set.");
        }

        return errors.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(errors);
    }
}
```

### 9.2 `EntraIdSettingsValidator.cs`

When `Enabled=true`, require TenantId + ClientId + at least one Audience.
When `Enabled=false`, accept whatever (host falls back to dev JWT).

(Other validators follow the same pattern — see `Configuration/Validation/`.)

## 10. Verify

```csharp
// Program.cs (Api host) — wire all validators + bind sections
services.AddSingleton<IValidateOptions<DatabaseSettings>, DatabaseSettingsValidator>();
services.AddSingleton<IValidateOptions<EntraIdSettings>, EntraIdSettingsValidator>();
services.AddSingleton<IValidateOptions<CacheSettings>, CacheSettingsValidator>();
// ...

services.AddValidatedOptions<DatabaseSettings>(configuration, DatabaseSettings.SectionName);
services.AddValidatedOptions<EntraIdSettings>(configuration, EntraIdSettings.SectionName);
services.AddValidatedOptions<EntraIdB2CSettings>(configuration, EntraIdB2CSettings.SectionName);
services.AddValidatedOptions<JwtSettings>(configuration, JwtSettings.SectionName);
services.AddValidatedOptions<CorsSettings>(configuration, CorsSettings.SectionName);
services.AddValidatedOptions<CacheSettings>(configuration, CacheSettings.SectionName);
services.AddValidatedOptions<MultiTenancySettings>(configuration, MultiTenancySettings.SectionName);
services.AddValidatedOptions<RateLimitSettings>(configuration, RateLimitSettings.SectionName);
services.AddValidatedOptions<ObservabilitySettings>(configuration, ObservabilitySettings.SectionName);
```

Try booting with a deliberately wrong setting (e.g. blank `TenantId` while
`AzureAd:Enabled=true`). Host should fail at startup with:

```
Microsoft.Extensions.Options.OptionsValidationException:
  AzureAd:TenantId must be set.
```

That's the desired behavior — the alternative (silent boot, mysterious 401s
on first login) is much worse.

---

**Next:** [`05-Backend-Request-Flow.md`](05-Backend-Request-Flow.md) — how a
request flows through the API (middleware → endpoint → filters → handler →
behaviors → repository → DB) and how the Worker orchestrates jobs.
