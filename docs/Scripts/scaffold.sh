#!/bin/bash
# ==============================================================================
# Enterprise.Platform - Solution Scaffold Script
# ==============================================================================
# Target: .NET 10 + Angular 21 | Azure-first | Clean Architecture + CQRS
# Run:    bash master-script.sh
# ==============================================================================

set -euo pipefail

# -------------------------------------------------------
# CONFIGURATION - Update these before running
# -------------------------------------------------------
SOLUTION_NAME="Enterprise.Platform"
ROOT_DIR="$(pwd)/${SOLUTION_NAME}"
DOTNET_VERSION="net10.0"
ANGULAR_VERSION="21"

echo "============================================="
echo " Scaffolding: ${SOLUTION_NAME}"
echo " Target: ${DOTNET_VERSION} + Angular ${ANGULAR_VERSION}"
echo " Location: ${ROOT_DIR}"
echo "============================================="

# -------------------------------------------------------
# 0. Create root directory + solution
# -------------------------------------------------------
mkdir -p "${ROOT_DIR}"
cd "${ROOT_DIR}"

dotnet new sln -n "${SOLUTION_NAME}"

# -------------------------------------------------------
# 1. Create global.json (pin SDK version)
# -------------------------------------------------------
cat > global.json << 'GLOBALEOF'
{
  "sdk": {
    "version": "10.0.100",
    "rollForward": "latestFeature",
    "allowPrerelease": true
  }
}
GLOBALEOF

# -------------------------------------------------------
# 2. Create Directory.Build.props (shared build config)
# -------------------------------------------------------
cat > Directory.Build.props << 'BUILDEOF'
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
    <NuGetAuditMode>all</NuGetAuditMode>
  </PropertyGroup>
</Project>
BUILDEOF

# -------------------------------------------------------
# 3. Create Directory.Packages.props (central pkg mgmt)
#    NOTE: Update versions to latest stable when running
# -------------------------------------------------------
cat > Directory.Packages.props << 'PKGEOF'
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

    <!-- Identity & Auth -->
    <PackageVersion Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="10.0.0" />
    <PackageVersion Include="Microsoft.AspNetCore.Authentication.OpenIdConnect" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Identity.Web" Version="3.5.0" />

    <!-- Validation -->
    <PackageVersion Include="FluentValidation" Version="11.11.0" />
    <PackageVersion Include="FluentValidation.DependencyInjectionExtensions" Version="11.11.0" />

    <!-- Resilience -->
    <PackageVersion Include="Microsoft.Extensions.Http.Resilience" Version="10.0.0" />
    <PackageVersion Include="Microsoft.Extensions.Resilience" Version="10.0.0" />

    <!-- Observability -->
    <PackageVersion Include="OpenTelemetry.Extensions.Hosting" Version="1.12.0" />
    <PackageVersion Include="OpenTelemetry.Instrumentation.AspNetCore" Version="1.12.0" />
    <PackageVersion Include="OpenTelemetry.Instrumentation.EntityFrameworkCore" Version="1.0.0-beta.15" />
    <PackageVersion Include="OpenTelemetry.Instrumentation.Http" Version="1.12.0" />
    <PackageVersion Include="OpenTelemetry.Instrumentation.SqlClient" Version="1.10.0-beta.1" />
    <PackageVersion Include="OpenTelemetry.Exporter.OpenTelemetryProtocol" Version="1.12.0" />

    <!-- Caching -->
    <PackageVersion Include="Microsoft.Extensions.Caching.StackExchangeRedis" Version="10.0.0" />

    <!-- API -->
    <PackageVersion Include="Asp.Versioning.Http" Version="8.1.0" />
    <PackageVersion Include="Swashbuckle.AspNetCore" Version="7.2.0" />
    <PackageVersion Include="Microsoft.AspNetCore.OpenApi" Version="10.0.0" />

    <!-- Azure -->
    <PackageVersion Include="Azure.Identity" Version="1.13.2" />
    <PackageVersion Include="Azure.Extensions.AspNetCore.Configuration.Secrets" Version="1.4.0" />
    <PackageVersion Include="Azure.Storage.Blobs" Version="12.23.0" />
    <PackageVersion Include="Microsoft.Extensions.Configuration.AzureAppConfiguration" Version="8.1.0" />

    <!-- Background Jobs -->
    <PackageVersion Include="Hangfire.Core" Version="1.8.17" />
    <PackageVersion Include="Hangfire.SqlServer" Version="1.8.17" />
    <PackageVersion Include="Hangfire.AspNetCore" Version="1.8.17" />

    <!-- Data Protection -->
    <PackageVersion Include="Microsoft.AspNetCore.DataProtection.AzureKeyVault" Version="3.1.24" />
    <PackageVersion Include="Azure.Security.KeyVault.Keys" Version="4.7.0" />

    <!-- Logging -->
    <PackageVersion Include="Serilog.AspNetCore" Version="9.0.0" />
    <PackageVersion Include="Serilog.Sinks.Console" Version="6.0.0" />
    <PackageVersion Include="Serilog.Sinks.Seq" Version="9.0.0" />
    <PackageVersion Include="Serilog.Enrichers.Environment" Version="3.0.1" />
    <PackageVersion Include="Serilog.Enrichers.Thread" Version="4.0.0" />

    <!-- Testing -->
    <PackageVersion Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
    <PackageVersion Include="xunit" Version="2.9.3" />
    <PackageVersion Include="xunit.runner.visualstudio" Version="2.8.2" />
    <PackageVersion Include="Moq" Version="4.20.72" />
    <PackageVersion Include="FluentAssertions" Version="7.1.0" />
    <PackageVersion Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.0" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.InMemory" Version="10.0.0" />
    <PackageVersion Include="NetArchTest.Rules" Version="1.3.2" />
    <PackageVersion Include="Bogus" Version="35.6.1" />
  </ItemGroup>
</Project>
PKGEOF

# -------------------------------------------------------
# 4. Create .editorconfig
# -------------------------------------------------------
cat > .editorconfig << 'EDITOREOF'
root = true

[*]
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.{cs,csx}]
# Organize usings
dotnet_sort_system_directives_first = true
dotnet_separate_import_directive_groups = false

# this. preferences
dotnet_style_qualification_for_field = false:warning
dotnet_style_qualification_for_property = false:warning
dotnet_style_qualification_for_method = false:warning
dotnet_style_qualification_for_event = false:warning

# var preferences
csharp_style_var_for_built_in_types = false:suggestion
csharp_style_var_when_type_is_apparent = true:suggestion
csharp_style_var_elsewhere = true:suggestion

# Expression-bodied members
csharp_style_expression_bodied_methods = when_on_single_line:suggestion
csharp_style_expression_bodied_constructors = false:suggestion
csharp_style_expression_bodied_properties = true:suggestion

# Naming conventions
dotnet_naming_rule.private_fields_should_be_camel_case.severity = warning
dotnet_naming_rule.private_fields_should_be_camel_case.symbols = private_fields
dotnet_naming_rule.private_fields_should_be_camel_case.style = camel_case_underscore
dotnet_naming_symbols.private_fields.applicable_kinds = field
dotnet_naming_symbols.private_fields.applicable_accessibilities = private
dotnet_naming_style.camel_case_underscore.required_prefix = _
dotnet_naming_style.camel_case_underscore.capitalization = camel_case

dotnet_naming_rule.interfaces_should_begin_with_i.severity = warning
dotnet_naming_rule.interfaces_should_begin_with_i.symbols = interfaces
dotnet_naming_rule.interfaces_should_begin_with_i.style = begins_with_i
dotnet_naming_symbols.interfaces.applicable_kinds = interface
dotnet_naming_style.begins_with_i.required_prefix = I
dotnet_naming_style.begins_with_i.capitalization = pascal_case

[*.{json,yml,yaml}]
indent_size = 2

[*.md]
trim_trailing_whitespace = false
EDITOREOF

# -------------------------------------------------------
# 5. Create nuget.config
# -------------------------------------------------------
cat > nuget.config << 'NUGETEOF'
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
NUGETEOF

# -------------------------------------------------------
# 6. Create source directory structure
# -------------------------------------------------------
mkdir -p src/{Presentation,API,Core,Infrastructure,Contracts,Batch}

# ==============================================================================
# 7. CREATE PROJECTS
# ==============================================================================

# --- 7.1 Shared (leaf node - no references) ---
dotnet new classlib -n "${SOLUTION_NAME}.Shared" -o "src/Contracts/${SOLUTION_NAME}.Shared"
dotnet sln add "src/Contracts/${SOLUTION_NAME}.Shared"

# --- 7.2 Contracts (depends on Shared) ---
dotnet new classlib -n "${SOLUTION_NAME}.Contracts" -o "src/Contracts/${SOLUTION_NAME}.Contracts"
dotnet sln add "src/Contracts/${SOLUTION_NAME}.Contracts"
dotnet add "src/Contracts/${SOLUTION_NAME}.Contracts" reference "src/Contracts/${SOLUTION_NAME}.Shared"

# --- 7.3 Domain (depends on Shared only) ---
dotnet new classlib -n "${SOLUTION_NAME}.Domain" -o "src/Core/${SOLUTION_NAME}.Domain"
dotnet sln add "src/Core/${SOLUTION_NAME}.Domain"
dotnet add "src/Core/${SOLUTION_NAME}.Domain" reference "src/Contracts/${SOLUTION_NAME}.Shared"

# --- 7.4 Application (depends on Domain, Contracts, Shared) ---
dotnet new classlib -n "${SOLUTION_NAME}.Application" -o "src/Core/${SOLUTION_NAME}.Application"
dotnet sln add "src/Core/${SOLUTION_NAME}.Application"
dotnet add "src/Core/${SOLUTION_NAME}.Application" reference "src/Core/${SOLUTION_NAME}.Domain"
dotnet add "src/Core/${SOLUTION_NAME}.Application" reference "src/Contracts/${SOLUTION_NAME}.Contracts"
dotnet add "src/Core/${SOLUTION_NAME}.Application" reference "src/Contracts/${SOLUTION_NAME}.Shared"

# --- 7.5 Infrastructure (depends on Domain, Application, Contracts, Shared) ---
dotnet new classlib -n "${SOLUTION_NAME}.Infrastructure" -o "src/Infrastructure/${SOLUTION_NAME}.Infrastructure"
dotnet sln add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure"
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" reference "src/Core/${SOLUTION_NAME}.Domain"
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" reference "src/Core/${SOLUTION_NAME}.Application"
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" reference "src/Contracts/${SOLUTION_NAME}.Contracts"
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" reference "src/Contracts/${SOLUTION_NAME}.Shared"

# --- 7.6 API (depends on Application, Infrastructure, Contracts, Shared) ---
dotnet new webapi -n "${SOLUTION_NAME}.Api" -o "src/API/${SOLUTION_NAME}.Api" --use-minimal-apis
dotnet sln add "src/API/${SOLUTION_NAME}.Api"
dotnet add "src/API/${SOLUTION_NAME}.Api" reference "src/Core/${SOLUTION_NAME}.Application"
dotnet add "src/API/${SOLUTION_NAME}.Api" reference "src/Infrastructure/${SOLUTION_NAME}.Infrastructure"
dotnet add "src/API/${SOLUTION_NAME}.Api" reference "src/Contracts/${SOLUTION_NAME}.Contracts"
dotnet add "src/API/${SOLUTION_NAME}.Api" reference "src/Contracts/${SOLUTION_NAME}.Shared"

# --- 7.7 BFF (depends on Contracts, Shared) ---
dotnet new mvc -n "${SOLUTION_NAME}.Web.Bff" -o "src/Presentation/${SOLUTION_NAME}.Web.Bff"
dotnet sln add "src/Presentation/${SOLUTION_NAME}.Web.Bff"
dotnet add "src/Presentation/${SOLUTION_NAME}.Web.Bff" reference "src/Contracts/${SOLUTION_NAME}.Contracts"
dotnet add "src/Presentation/${SOLUTION_NAME}.Web.Bff" reference "src/Contracts/${SOLUTION_NAME}.Shared"

# --- 7.8 Worker Service (depends on Application, Infrastructure, Shared) ---
dotnet new worker -n "${SOLUTION_NAME}.Worker" -o "src/Batch/${SOLUTION_NAME}.Worker"
dotnet sln add "src/Batch/${SOLUTION_NAME}.Worker"
dotnet add "src/Batch/${SOLUTION_NAME}.Worker" reference "src/Core/${SOLUTION_NAME}.Application"
dotnet add "src/Batch/${SOLUTION_NAME}.Worker" reference "src/Infrastructure/${SOLUTION_NAME}.Infrastructure"
dotnet add "src/Batch/${SOLUTION_NAME}.Worker" reference "src/Contracts/${SOLUTION_NAME}.Shared"

# ==============================================================================
# 8. CREATE TEST PROJECTS
# ==============================================================================

mkdir -p tests

# --- 8.1 Domain Tests ---
dotnet new xunit -n "${SOLUTION_NAME}.Domain.Tests" -o "tests/${SOLUTION_NAME}.Domain.Tests"
dotnet sln add "tests/${SOLUTION_NAME}.Domain.Tests"
dotnet add "tests/${SOLUTION_NAME}.Domain.Tests" reference "src/Core/${SOLUTION_NAME}.Domain"

# --- 8.2 Application Tests ---
dotnet new xunit -n "${SOLUTION_NAME}.Application.Tests" -o "tests/${SOLUTION_NAME}.Application.Tests"
dotnet sln add "tests/${SOLUTION_NAME}.Application.Tests"
dotnet add "tests/${SOLUTION_NAME}.Application.Tests" reference "src/Core/${SOLUTION_NAME}.Application"
dotnet add "tests/${SOLUTION_NAME}.Application.Tests" reference "src/Infrastructure/${SOLUTION_NAME}.Infrastructure"

# --- 8.3 Infrastructure Tests ---
dotnet new xunit -n "${SOLUTION_NAME}.Infrastructure.Tests" -o "tests/${SOLUTION_NAME}.Infrastructure.Tests"
dotnet sln add "tests/${SOLUTION_NAME}.Infrastructure.Tests"
dotnet add "tests/${SOLUTION_NAME}.Infrastructure.Tests" reference "src/Infrastructure/${SOLUTION_NAME}.Infrastructure"

# --- 8.4 API Integration Tests ---
dotnet new xunit -n "${SOLUTION_NAME}.Api.Tests" -o "tests/${SOLUTION_NAME}.Api.Tests"
dotnet sln add "tests/${SOLUTION_NAME}.Api.Tests"
dotnet add "tests/${SOLUTION_NAME}.Api.Tests" reference "src/API/${SOLUTION_NAME}.Api"

# --- 8.5 Architecture Tests ---
dotnet new xunit -n "${SOLUTION_NAME}.Architecture.Tests" -o "tests/${SOLUTION_NAME}.Architecture.Tests"
dotnet sln add "tests/${SOLUTION_NAME}.Architecture.Tests"
dotnet add "tests/${SOLUTION_NAME}.Architecture.Tests" reference "src/Core/${SOLUTION_NAME}.Domain"
dotnet add "tests/${SOLUTION_NAME}.Architecture.Tests" reference "src/Core/${SOLUTION_NAME}.Application"
dotnet add "tests/${SOLUTION_NAME}.Architecture.Tests" reference "src/Infrastructure/${SOLUTION_NAME}.Infrastructure"

# ==============================================================================
# 9. ADD NUGET PACKAGES TO PROJECTS
# ==============================================================================

# --- 9.1 Shared (zero packages - pure C#) ---
# No packages needed

# --- 9.2 Contracts ---
# No packages needed (POCOs only)

# --- 9.3 Domain ---
# No packages needed (pure domain, zero dependencies)

# --- 9.4 Application ---
dotnet add "src/Core/${SOLUTION_NAME}.Application" package FluentValidation
dotnet add "src/Core/${SOLUTION_NAME}.Application" package FluentValidation.DependencyInjectionExtensions

# --- 9.5 Infrastructure ---
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.EntityFrameworkCore
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.EntityFrameworkCore.SqlServer
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.EntityFrameworkCore.Tools
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.AspNetCore.Authentication.JwtBearer
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.AspNetCore.Authentication.OpenIdConnect
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.Extensions.Http.Resilience
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.Extensions.Resilience
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Microsoft.Extensions.Caching.StackExchangeRedis
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package OpenTelemetry.Extensions.Hosting
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package OpenTelemetry.Instrumentation.AspNetCore
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package OpenTelemetry.Instrumentation.EntityFrameworkCore
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package OpenTelemetry.Instrumentation.Http
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package OpenTelemetry.Instrumentation.SqlClient
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package OpenTelemetry.Exporter.OpenTelemetryProtocol
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Azure.Identity
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Azure.Extensions.AspNetCore.Configuration.Secrets
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Azure.Storage.Blobs
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Azure.Security.KeyVault.Keys
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Hangfire.Core
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Hangfire.SqlServer
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Serilog.AspNetCore
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Serilog.Sinks.Console
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Serilog.Sinks.Seq
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Serilog.Enrichers.Environment
dotnet add "src/Infrastructure/${SOLUTION_NAME}.Infrastructure" package Serilog.Enrichers.Thread

# --- 9.6 API ---
dotnet add "src/API/${SOLUTION_NAME}.Api" package Asp.Versioning.Http
dotnet add "src/API/${SOLUTION_NAME}.Api" package Swashbuckle.AspNetCore
dotnet add "src/API/${SOLUTION_NAME}.Api" package Microsoft.AspNetCore.OpenApi
dotnet add "src/API/${SOLUTION_NAME}.Api" package Hangfire.AspNetCore
dotnet add "src/API/${SOLUTION_NAME}.Api" package Serilog.AspNetCore

# --- 9.7 BFF ---
dotnet add "src/Presentation/${SOLUTION_NAME}.Web.Bff" package Microsoft.AspNetCore.Authentication.JwtBearer
dotnet add "src/Presentation/${SOLUTION_NAME}.Web.Bff" package Microsoft.AspNetCore.Authentication.OpenIdConnect
dotnet add "src/Presentation/${SOLUTION_NAME}.Web.Bff" package Serilog.AspNetCore

# --- 9.8 Worker ---
dotnet add "src/Batch/${SOLUTION_NAME}.Worker" package Hangfire.Core
dotnet add "src/Batch/${SOLUTION_NAME}.Worker" package Hangfire.SqlServer
dotnet add "src/Batch/${SOLUTION_NAME}.Worker" package Serilog.AspNetCore

# --- 9.9 Test Projects ---
for TEST_PROJ in \
  "tests/${SOLUTION_NAME}.Domain.Tests" \
  "tests/${SOLUTION_NAME}.Application.Tests" \
  "tests/${SOLUTION_NAME}.Infrastructure.Tests" \
  "tests/${SOLUTION_NAME}.Api.Tests" \
  "tests/${SOLUTION_NAME}.Architecture.Tests"; do
  dotnet add "${TEST_PROJ}" package Moq
  dotnet add "${TEST_PROJ}" package FluentAssertions
  dotnet add "${TEST_PROJ}" package Bogus
done

dotnet add "tests/${SOLUTION_NAME}.Api.Tests" package Microsoft.AspNetCore.Mvc.Testing
dotnet add "tests/${SOLUTION_NAME}.Infrastructure.Tests" package Microsoft.EntityFrameworkCore.InMemory
dotnet add "tests/${SOLUTION_NAME}.Architecture.Tests" package NetArchTest.Rules

# ==============================================================================
# 10. CREATE FOLDER STRUCTURES INSIDE PROJECTS
# ==============================================================================

# --- 10.1 Shared ---
SHARED="src/Contracts/${SOLUTION_NAME}.Shared"
mkdir -p "${SHARED}"/{Results,Guards,Extensions,Constants,Enumerations}

# --- 10.2 Contracts ---
CONTRACTS="src/Contracts/${SOLUTION_NAME}.Contracts"
mkdir -p "${CONTRACTS}"/{DTOs,Requests,Responses,Settings}

# --- 10.3 Domain ---
DOMAIN="src/Core/${SOLUTION_NAME}.Domain"
mkdir -p "${DOMAIN}"/{Entities,ValueObjects,Aggregates,Events,Specifications,Interfaces,Enumerations,Exceptions}

# --- 10.4 Application ---
APP="src/Core/${SOLUTION_NAME}.Application"
mkdir -p "${APP}"/Abstractions/{Messaging,Behaviors,Persistence}
mkdir -p "${APP}"/Behaviors
mkdir -p "${APP}"/Dispatcher
mkdir -p "${APP}"/Features/Identity/{Commands,Queries,Events,Services}
mkdir -p "${APP}"/Features/Tenants/{Commands,Queries,Events}
mkdir -p "${APP}"/Features/AuditLog/Queries
mkdir -p "${APP}"/Common/{Interfaces,Models,Extensions,Mappings}

# --- 10.5 Infrastructure ---
INFRA="src/Infrastructure/${SOLUTION_NAME}.Infrastructure"
mkdir -p "${INFRA}"/Persistence/{Configurations,Interceptors,Migrations,Seeding}
mkdir -p "${INFRA}"/Identity/{OAuth,Authorization,Services}
mkdir -p "${INFRA}"/Caching
mkdir -p "${INFRA}"/Messaging/{Outbox,DomainEvents,IntegrationEvents}
mkdir -p "${INFRA}"/Resilience
mkdir -p "${INFRA}"/Observability
mkdir -p "${INFRA}"/Security/DataEncryption
mkdir -p "${INFRA}"/BackgroundJobs
mkdir -p "${INFRA}"/ExternalServices
mkdir -p "${INFRA}"/FileStorage
mkdir -p "${INFRA}"/Email
mkdir -p "${INFRA}"/FeatureFlags
mkdir -p "${INFRA}"/MultiTenancy

# --- 10.6 API ---
API="src/API/${SOLUTION_NAME}.Api"
mkdir -p "${API}"/Endpoints/v1
mkdir -p "${API}"/{Middleware,Filters,Configuration,Extensions}

# --- 10.7 BFF ---
BFF="src/Presentation/${SOLUTION_NAME}.Web.Bff"
mkdir -p "${BFF}"/{Controllers,Configuration}
# Angular will be scaffolded separately via ng new

# --- 10.8 Worker ---
WORKER="src/Batch/${SOLUTION_NAME}.Worker"
mkdir -p "${WORKER}"/Jobs

# --- 10.9 Test folders ---
mkdir -p "tests/${SOLUTION_NAME}.Domain.Tests"/{ValueObjects,Entities,Specifications}
mkdir -p "tests/${SOLUTION_NAME}.Application.Tests"/{Features/Identity,Features/Tenants,Behaviors}
mkdir -p "tests/${SOLUTION_NAME}.Infrastructure.Tests"/{Persistence,Security}
mkdir -p "tests/${SOLUTION_NAME}.Api.Tests"/{Utilities,Endpoints}
mkdir -p "tests/${SOLUTION_NAME}.Architecture.Tests"

# --- 10.10 Docker ---
mkdir -p docker

# --- 10.11 Infrastructure as Code ---
mkdir -p infra/{bicep/modules,terraform}

# --- 10.12 GitHub Actions ---
mkdir -p .github/workflows

# ==============================================================================
# 11. CLEANUP DEFAULT FILES (remove auto-generated Class1.cs, etc.)
# ==============================================================================

# Remove default Class1.cs from class libraries
find src -name "Class1.cs" -delete 2>/dev/null || true

# Remove default WeatherForecast files from webapi template
find src -name "WeatherForecast*" -delete 2>/dev/null || true

# Remove default Worker.cs (we'll create our own)
find src/Batch -name "Worker.cs" -delete 2>/dev/null || true

# Remove auto-generated Controllers from MVC template (we'll create our own)
find "src/Presentation" -path "*/Controllers/HomeController.cs" -delete 2>/dev/null || true

# ==============================================================================
# 12. CREATE PLACEHOLDER .gitkeep FILES
#     (keeps empty directories in git)
# ==============================================================================

find . -type d -empty -not -path "./.git/*" -exec touch {}/.gitkeep \;

# ==============================================================================
# 13. CREATE .gitignore
# ==============================================================================

cat > .gitignore << 'GITIGNOREEOF'
## .NET
bin/
obj/
*.user
*.suo
*.cache
*.vs/
*.DotSettings.user

## IDE
.idea/
.vscode/
*.swp

## Build
[Dd]ebug/
[Rr]elease/
publish/
out/

## NuGet
*.nupkg
**/packages/

## Secrets
appsettings.*.local.json
*.pfx
*.key

## Node (Angular)
node_modules/
dist/
.angular/
npm-debug.log*
yarn-error.log*

## Docker
docker-compose.override.local.yml

## OS
.DS_Store
Thumbs.db

## Test results
TestResults/
coverage/
*.trx
GITIGNOREEOF

# ==============================================================================
# 14. VERIFY BUILD
# ==============================================================================

echo ""
echo "============================================="
echo " Restoring packages..."
echo "============================================="
dotnet restore

echo ""
echo "============================================="
echo " Building solution..."
echo "============================================="
dotnet build --no-restore

echo ""
echo "============================================="
echo " SCAFFOLD COMPLETE"
echo "============================================="
echo ""
echo " Solution: ${ROOT_DIR}/${SOLUTION_NAME}.sln"
echo " Projects: $(find src -name '*.csproj' | wc -l) source + $(find tests -name '*.csproj' | wc -l) test"
echo ""
echo " Next steps:"
echo "   1. Review and customize Directory.Packages.props versions"
echo "   2. cd ${ROOT_DIR} && dotnet build"
echo "   3. Start implementing foundation files (see architecture docs)"
echo "   4. Scaffold Angular: cd src/Presentation/${SOLUTION_NAME}.Web.Bff && ng new ClientApp --style=scss --routing"
echo ""
