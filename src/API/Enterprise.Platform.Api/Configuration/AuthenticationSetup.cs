using System.Diagnostics.Metrics;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Infrastructure.Configuration.Validation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Identity.Web;
using Microsoft.IdentityModel.Tokens;
using EpClaimTypes = Enterprise.Platform.Shared.Constants.ClaimTypes;

namespace Enterprise.Platform.Api.Configuration;

/// <summary>
/// Configures JWT bearer authentication against Azure Entra ID (B2B) and optionally
/// Entra B2C. The Api <b>validates</b> tokens issued by Entra; it <b>never issues</b>
/// them — per D4 the platform-side <c>TokenService</c> is deferred, and the modern
/// flow is MSAL.js in the SPA going directly to Entra. A policy scheme forwards
/// incoming bearer tokens to the appropriate handler by peeking the <c>iss</c>
/// claim of the incoming token.
/// </summary>
/// <remarks>
/// <para>
/// Dev fallback: when both <see cref="EntraIdSettings.Enabled"/> and
/// <see cref="EntraIdB2CSettings.Enabled"/> are <c>false</c>, the setup falls back
/// to a symmetric-key <c>AddJwtBearer</c> using <see cref="JwtSettings"/> so
/// <c>dotnet run</c> works without an Entra tenant.
/// </para>
/// <para>
/// Tenant mapping: on successful B2B validation, a derived <c>ep:tenant_id</c>
/// claim is added to the <see cref="ClaimsPrincipal"/> using
/// <see cref="EntraIdSettings.PlatformTenantMapping"/> (Entra <c>tid</c> → platform
/// tenant Guid). <c>CurrentTenantService</c> downstream reads the derived claim
/// transparently.
/// </para>
/// </remarks>
public static class AuthenticationSetup
{
    /// <summary>Scheme name used for B2B (Azure AD) bearer validation.</summary>
    public const string B2BScheme = JwtBearerDefaults.AuthenticationScheme;

    /// <summary>Scheme name used for Entra B2C bearer validation.</summary>
    public const string B2CScheme = "EntraB2C";

    /// <summary>Scheme name used for the dev symmetric-key fallback.</summary>
    public const string DevScheme = "EpDev";

    /// <summary>Policy scheme that selects the right handler based on the token's issuer.</summary>
    public const string PolicyScheme = "EpAuth";

    /// <summary>Wires authentication — B2B, B2C, and/or dev symmetric-key as appropriate.</summary>
    public static IServiceCollection AddPlatformAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var entraSettings = configuration.GetSection(EntraIdSettings.SectionName).Get<EntraIdSettings>() ?? new EntraIdSettings();
        var b2cSettings = configuration.GetSection(EntraIdB2CSettings.SectionName).Get<EntraIdB2CSettings>() ?? new EntraIdB2CSettings();
        var jwtSettings = configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>() ?? new JwtSettings();

        var entraEnabled = entraSettings.Enabled && !string.IsNullOrWhiteSpace(entraSettings.ClientId);
        var b2cEnabled = b2cSettings.Enabled && !string.IsNullOrWhiteSpace(b2cSettings.ClientId);

        // ValidateOnStart — without it the `IValidateOptions<EntraIdSettings>` +
        // `IValidateOptions<EntraIdB2CSettings>` cross-property validators registered
        // in ServiceCollectionExtensions.cs would fire lazily on first IOptions
        // resolution (and nothing in the app resolves these), silently accepting bad
        // config. Routing through AddValidatedOptions forces validation at host build.
        services.AddValidatedOptions<EntraIdSettings>(configuration, EntraIdSettings.SectionName);
        services.AddValidatedOptions<EntraIdB2CSettings>(configuration, EntraIdB2CSettings.SectionName);

        var authBuilder = services.AddAuthentication(options =>
        {
            options.DefaultScheme = PolicyScheme;
            options.DefaultChallengeScheme = PolicyScheme;
        });

        authBuilder.AddPolicyScheme(PolicyScheme, PolicyScheme, options =>
        {
            options.ForwardDefaultSelector = context =>
            {
                var header = context.Request.Headers.Authorization.ToString();
                if (string.IsNullOrWhiteSpace(header) || !header.StartsWith("Bearer ", StringComparison.Ordinal))
                {
                    return entraEnabled ? B2BScheme : b2cEnabled ? B2CScheme : DevScheme;
                }

                var token = header["Bearer ".Length..].Trim();
                var issuer = TryReadIssuer(token);
                if (!string.IsNullOrEmpty(issuer))
                {
                    if (b2cEnabled && !string.IsNullOrEmpty(b2cSettings.Domain)
                        && issuer.Contains(b2cSettings.Domain, StringComparison.OrdinalIgnoreCase))
                    {
                        return B2CScheme;
                    }

                    if (entraEnabled && issuer.Contains("login.microsoftonline.com", StringComparison.OrdinalIgnoreCase))
                    {
                        return B2BScheme;
                    }
                }

                return entraEnabled ? B2BScheme : b2cEnabled ? B2CScheme : DevScheme;
            };
        });

        if (entraEnabled)
        {
            // Audience-match telemetry (Phase 9.C.1). Singleton wrapper holds
            // the Counter<long> so the OnTokenValidated event can emit it
            // without per-request meter construction. Drives the decision to
            // harden audience validation (Phase 9.C.3) — flip to api-prefixed
            // only when the implicit-clientid counter is zero across a
            // representative window in prod.
            services.AddSingleton<AudienceMatchMetric>();

            authBuilder.AddMicrosoftIdentityWebApi(
                jwtBearerOptions => ConfigureEntraB2BJwt(jwtBearerOptions, entraSettings),
                microsoftIdentityOptions => configuration.Bind(EntraIdSettings.SectionName, microsoftIdentityOptions),
                jwtBearerScheme: B2BScheme,
                subscribeToJwtBearerMiddlewareDiagnosticsEvents: false);
        }

        if (b2cEnabled)
        {
            authBuilder.AddMicrosoftIdentityWebApi(
                jwtBearerOptions => ConfigureEntraB2CJwt(jwtBearerOptions, b2cSettings),
                microsoftIdentityOptions => configuration.Bind(EntraIdB2CSettings.SectionName, microsoftIdentityOptions),
                jwtBearerScheme: B2CScheme,
                subscribeToJwtBearerMiddlewareDiagnosticsEvents: false);
        }

        if (!entraEnabled && !b2cEnabled)
        {
            authBuilder.AddJwtBearer(DevScheme, options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = !string.IsNullOrWhiteSpace(jwtSettings.Issuer),
                    ValidIssuer = jwtSettings.Issuer,
                    ValidateAudience = !string.IsNullOrWhiteSpace(jwtSettings.Audience),
                    ValidAudience = jwtSettings.Audience,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ClockSkew = jwtSettings.ClockSkew,
                    IssuerSigningKey = string.IsNullOrWhiteSpace(jwtSettings.SigningKey)
                        ? null
                        : new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SigningKey)),
                };
                options.IncludeErrorDetails = false;
            });
        }

        services.AddAuthorization();
        return services;
    }

    private static void ConfigureEntraB2BJwt(JwtBearerOptions options, EntraIdSettings settings)
    {
        if (settings.Audiences.Count > 0)
        {
            options.TokenValidationParameters.ValidAudiences = settings.Audiences;
        }

        if (settings.AllowedIssuers.Count > 0)
        {
            options.TokenValidationParameters.ValidateIssuer = true;
            options.TokenValidationParameters.ValidIssuers = settings.AllowedIssuers;
        }

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = ctx =>
            {
                MapEntraTenantToPlatformTenant(ctx.Principal, settings);
                EmitAudienceMatchedTelemetry(ctx);
                return Task.CompletedTask;
            },
        };
    }

    /// <summary>
    /// Records which configured audience matched the validated token (Phase 9.C.1).
    /// </summary>
    private static void EmitAudienceMatchedTelemetry(TokenValidatedContext ctx)
    {
        var metric = ctx.HttpContext.RequestServices.GetService<AudienceMatchMetric>();
        if (metric is null)
        {
            return;
        }

        var aud = ctx.SecurityToken is JwtSecurityToken jwt
            ? jwt.Audiences.FirstOrDefault()
            : null;

        var kind = aud switch
        {
            null => "missing",
            { } a when a.StartsWith("api://", StringComparison.OrdinalIgnoreCase) => "api_prefixed",
            { } a when Guid.TryParse(a, out _) => "implicit_clientid",
            _ => "other",
        };

        metric.Counter.Add(1, KeyValuePair.Create<string, object?>("audience_kind", kind));
    }

    private static void ConfigureEntraB2CJwt(JwtBearerOptions options, EntraIdB2CSettings settings)
    {
        if (settings.Audiences.Count > 0)
        {
            options.TokenValidationParameters.ValidAudiences = settings.Audiences;
        }

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = ctx =>
            {
                var issuer = ctx.SecurityToken?.Issuer ?? string.Empty;
                var allowed = settings.AllowedPolicies.Count > 0
                    ? settings.AllowedPolicies
                    : string.IsNullOrWhiteSpace(settings.SignUpSignInPolicyId)
                        ? []
                        : new[] { settings.SignUpSignInPolicyId };

                if (allowed.Count > 0
                    && !allowed.Any(p => issuer.Contains(p, StringComparison.OrdinalIgnoreCase)))
                {
                    ctx.Fail("Token issued by a policy that isn't allowed by this Api.");
                }

                return Task.CompletedTask;
            },
        };
    }

    private static void MapEntraTenantToPlatformTenant(ClaimsPrincipal? principal, EntraIdSettings settings)
    {
        if (principal?.Identity is not ClaimsIdentity identity)
        {
            return;
        }

        if (identity.HasClaim(c => c.Type == EpClaimTypes.TenantId))
        {
            return;
        }

        var entraTenantId = identity.FindFirst(settings.TenantIdClaim)?.Value;
        if (string.IsNullOrWhiteSpace(entraTenantId))
        {
            return;
        }

        if (settings.PlatformTenantMapping.TryGetValue(entraTenantId, out var platformTenantId))
        {
            identity.AddClaim(new Claim(EpClaimTypes.TenantId, platformTenantId.ToString("D")));
        }
    }

    private static string? TryReadIssuer(string jwt)
    {
        var parts = jwt.Split('.');
        if (parts.Length < 2)
        {
            return null;
        }

        try
        {
            var payload = parts[1];
            switch (payload.Length % 4)
            {
                case 2: payload += "=="; break;
                case 3: payload += "="; break;
            }

            payload = payload.Replace('-', '+').Replace('_', '/');
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(payload));
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty("iss", out var iss) ? iss.GetString() : null;
        }
        catch
        {
            return null;
        }
    }
}

/// <summary>
/// Singleton holder for the audience-match counter (Phase 9.C.1). Lives as a
/// dedicated DI service so <see cref="JwtBearerEvents.OnTokenValidated"/> can
/// resolve it cheaply per request without re-creating the underlying
/// <see cref="Counter{T}"/> on each call.
/// </summary>
internal sealed class AudienceMatchMetric : IDisposable
{
    /// <summary>Meter name surfaced to OpenTelemetry / dotnet-counters.</summary>
    public const string MeterName = "Enterprise.Platform.Api";

    private readonly Meter _meter;

    /// <summary>
    /// Counter incremented per validated token. Tag <c>audience_kind</c>
    /// distinguishes which configured <c>AzureAd.Audiences</c> entry matched
    /// — drives the Phase 9.C.3 "drop implicit-clientid acceptance" decision.
    /// </summary>
    public Counter<long> Counter { get; }

    public AudienceMatchMetric(IMeterFactory meterFactory)
    {
        ArgumentNullException.ThrowIfNull(meterFactory);
        _meter = meterFactory.Create(MeterName);
        Counter = _meter.CreateCounter<long>(
            "ep.api.token.audience_matched",
            unit: "{token}",
            description: "Validated tokens grouped by the audience claim shape (api_prefixed | implicit_clientid | other | missing).");
    }

    /// <inheritdoc />
    public void Dispose() => _meter.Dispose();
}
