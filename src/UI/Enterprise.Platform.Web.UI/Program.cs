using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Infrastructure.Observability;
using Enterprise.Platform.Web.UI.Configuration;
using Enterprise.Platform.Web.UI.Controllers;
using Enterprise.Platform.Web.UI.Endpoints;
using Enterprise.Platform.Web.UI.Middleware;
using Enterprise.Platform.Web.UI.Services.Graph;
using Enterprise.Platform.Web.UI.Setup;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Serilog;

// Bootstrap Serilog — same pattern as Api / Worker hosts.
var observability = new ObservabilitySettings();
var bootstrapLogger = StructuredLoggingSetup.BuildSerilogConfiguration(
        new ConfigurationBuilder().AddEnvironmentVariables().Build(),
        observability)
    .CreateBootstrapLogger();
Log.Logger = bootstrapLogger;

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Configuration
        .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
        .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
        .AddEnvironmentVariables();

    observability = builder.Configuration.GetSection(ObservabilitySettings.SectionName).Get<ObservabilitySettings>()
        ?? new ObservabilitySettings();

    builder.Host.UseSerilog((context, _, loggerConfig) =>
    {
        var config = StructuredLoggingSetup.BuildSerilogConfiguration(context.Configuration, observability);
        loggerConfig.WriteTo.Logger(config.CreateLogger());
    });

    // ── Settings binding ──────────────────────────────────────────────
    builder.Services.AddOptions<CorsSettings>().Bind(builder.Configuration.GetSection(CorsSettings.SectionName));
    builder.Services.AddOptions<ProxySettings>().Bind(builder.Configuration.GetSection(ProxySettings.SectionName));
    builder.Services.AddOptions<SpaHostingSettings>().Bind(builder.Configuration.GetSection(SpaHostingSettings.SectionName));

    // ── Platform composition ─────────────────────────────────────────
    builder.Services.AddPlatformAuthentication(builder.Configuration);
    builder.Services.AddPlatformCors(builder.Configuration);
    builder.Services.AddPlatformHealthChecks();
    builder.Services.AddPlatformRateLimiter();
    builder.Services.AddPlatformAntiforgery(builder.Environment);

    // ── Microsoft Graph integration ──────────────────────────────────
    // Fetches /me profile via the host's refresh-token-acquired Graph
    // token. IMemoryCache backs the per-user profile cache (5-min TTL).
    builder.Services.AddMemoryCache();
    builder.Services.AddHttpClient(GraphUserProfileService.TokenHttpClientName);
    builder.Services.AddHttpClient(GraphUserProfileService.GraphHttpClientName);
    builder.Services.AddScoped<GraphUserProfileService>();

    // ── Downstream Api HTTP client (used by ProxyController) ─────────
    builder.Services.AddHttpClient(ProxyController.HttpClientName);

    // `AddControllersWithViews()` (not just `AddControllers`) is required:
    // `[AutoValidateAntiforgeryToken]` on ProxyController lives in
    // `Mvc.ViewFeatures`, which isn't wired by the minimal `AddControllers`.
    // The razor-view overhead is negligible for an API-first host — we're
    // not rendering any views, but the filter infrastructure must be present.
    builder.Services.AddControllersWithViews();
    builder.Services.AddEndpointsApiExplorer();

    var app = builder.Build();

    // ── HTTP pipeline (outer → inner) ────────────────────────────────
    app.UseSecurityHeaders();
    app.UseCorrelationId();

    if (app.Environment.IsDevelopment())
    {
        app.UseDeveloperExceptionPage();
    }
    else
    {
        // No HomeController exists; emit a structured JSON ProblemDetails
        // payload appropriate for an API-first host that fronts the SPA via
        // the proxy fallback.
        app.UseExceptionHandler(builder => builder.Run(async ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
            ctx.Response.ContentType = "application/problem+json";
            await ctx.Response.WriteAsync(
                """{"title":"Internal server error","status":500,"detail":"An unexpected error occurred. Check correlation id in X-Correlation-ID."}""")
                .ConfigureAwait(false);
        }));
        app.UseHsts();
    }

    // HTTPS redirection is skipped in Development — the dev SPA flows
    // browser → host (HTTP :5001) → Api (HTTP :5044) and avoiding the
    // dev-cert dance keeps the loop fast. Prod terminates TLS at the
    // L7 load balancer ahead of this host.
    if (!app.Environment.IsDevelopment())
    {
        app.UseHttpsRedirection();
    }

    // ── Static-file serving for the SPA ──────────────────────────────
    // When SpaHosting:StaticRoot is configured, serve from that path
    // (typically Angular's dist/<project>/browser/ output produced by
    // `npm run watch`). Otherwise serve from the standard WebRootPath
    // (the prod layout where `ng build` output is copied into wwwroot/
    // at deploy time). A configured-but-missing directory logs a warning
    // and falls back to WebRootPath; the SPA fallback then surfaces a
    // diagnostic 404 if index.html is also absent.
    var spaSettings = app.Services.GetRequiredService<IOptions<SpaHostingSettings>>().Value;
    if (!string.IsNullOrWhiteSpace(spaSettings.StaticRoot))
    {
        var resolvedRoot = SpaFallbackEndpoint.ResolveStaticRoot(app.Environment, spaSettings.StaticRoot);
        if (Directory.Exists(resolvedRoot))
        {
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new PhysicalFileProvider(resolvedRoot),
            });
        }
        else
        {
            Log.Warning(
                "Web.UI SPA StaticRoot '{Root}' does not exist on disk; falling back to WebRootPath. Run `npm run watch` in ClientApp/ to populate the directory.",
                resolvedRoot);
            app.UseStaticFiles();
        }
    }
    else
    {
        app.UseStaticFiles();
    }

    app.UseRouting();

    app.UseCors(PlatformCorsSetup.PolicyName);

    // Edge rate limiter — runs before auth so unauthenticated abusers get
    // 429'd before they ever touch the OIDC pipeline. OIDC callback paths
    // (signin-oidc / signout-callback-oidc) are exempted in PlatformRateLimiterSetup.
    app.UseRateLimiter();

    app.UseAuthentication();
    app.UseAuthorization();

    // Health endpoints (anonymous — load balancers don't need credentials).
    app.MapHealthEndpoints();

    app.MapControllers();

    // SPA fallback — serves index.html for any unmatched route so Angular's
    // client-side router can resolve it. Must be the LAST endpoint
    // registration so it only catches what nothing else claimed.
    app.MapSpaFallback();

    Log.Information("Enterprise.Platform.Web.UI starting — environment={Environment}.", app.Environment.EnvironmentName);
    await app.RunAsync().ConfigureAwait(false);
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Enterprise.Platform.Web.UI terminated unexpectedly.");
    throw;
}
finally
{
    await Log.CloseAndFlushAsync().ConfigureAwait(false);
}
