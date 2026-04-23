using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Infrastructure.Observability;
using Enterprise.Platform.Web.UI.Configuration;
using Enterprise.Platform.Web.UI.Controllers;
using Serilog;
using HttpHeaderNames = Enterprise.Platform.Shared.Constants.HttpHeaderNames;

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

    // Settings binding
    builder.Services.AddOptions<CorsSettings>().Bind(builder.Configuration.GetSection(CorsSettings.SectionName));
    builder.Services.AddOptions<BffProxySettings>().Bind(builder.Configuration.GetSection(BffProxySettings.SectionName));
    builder.Services.AddOptions<BffSpaSettings>().Bind(builder.Configuration.GetSection(BffSpaSettings.SectionName));

    // BFF composition
    builder.Services.AddBffAuthentication(builder.Configuration);
    builder.Services.AddBffCors(builder.Configuration);
    builder.Services.AddBffHealthChecks();
    builder.Services.AddBffRateLimiter();

    // Anti-forgery: SPA expects the token via a readable cookie + echoes it in X-XSRF-TOKEN.
    // SecurePolicy: Always in prod (HTTPS required) / SameAsRequest in dev so plain-HTTP
    // `dotnet run` still works without a dev-cert dance. Same policy applied to the BFF
    // session cookie inside AddBffAuthentication when D4 lifts.
    var cookieSecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;

    builder.Services.AddAntiforgery(options =>
    {
        options.HeaderName = "X-XSRF-TOKEN";
        options.Cookie.Name = "__RequestVerificationToken";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = cookieSecurePolicy;
        options.Cookie.SameSite = SameSiteMode.Strict;
    });

    // Downstream Api client used by BffProxyController.
    builder.Services.AddHttpClient(BffProxyController.HttpClientName);

    // `AddControllersWithViews()` (not just `AddControllers`) is required here:
    // `[AutoValidateAntiforgeryToken]` on BffProxyController lives in
    // `Mvc.ViewFeatures`, which isn't wired by the minimal `AddControllers`.
    // The razor-view overhead is negligible for an API-first host — we're
    // not rendering any views, but the filter infrastructure must be present.
    builder.Services.AddControllersWithViews();
    builder.Services.AddEndpointsApiExplorer();

    var app = builder.Build();

    // Middleware pipeline — outer to inner.
    app.UseBffSecurityHeaders();

    // Correlation id — minted / echoed on every request (same convention as Api).
    app.Use(async (ctx, next) =>
    {
        var correlationId = ctx.Request.Headers.TryGetValue(HttpHeaderNames.CorrelationId, out var header)
                && !string.IsNullOrWhiteSpace(header)
            ? header.ToString()
            : Guid.NewGuid().ToString("D");
        ctx.Response.Headers[HttpHeaderNames.CorrelationId] = correlationId;
        using (Serilog.Context.LogContext.PushProperty("CorrelationId", correlationId))
        {
            await next().ConfigureAwait(false);
        }
    });

    if (app.Environment.IsDevelopment())
    {
        app.UseDeveloperExceptionPage();
    }
    else
    {
        // Phase-9 cutover: HomeController + Views/Home/Error.cshtml are gone
        // (removed with the scaffold). Emit a structured JSON ProblemDetails
        // payload — appropriate for an API-first host that fronts the SPA via
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

    // In dev the BFF binds HTTP on :5001 to match the Entra-registered redirect
    // URIs (localhost HTTP loopback is Entra-allowed; non-loopback hostnames
    // still demand HTTPS). Skipping HttpsRedirection here prevents a 307 from
    // http://localhost:5001/signin-oidc → https://localhost:7197/signin-oidc
    // which Entra would reject as an unregistered redirect URI.
    if (!app.Environment.IsDevelopment())
    {
        app.UseHttpsRedirection();
    }

    // Static-file serving — when BffSpaSettings.StaticRoot is configured,
    // serve from that path (typically Angular's dist/<project>/browser/
    // output produced by `npm run watch`). Otherwise serve from the standard
    // WebRootPath (the prod layout where `ng build` output is copied into
    // wwwroot/ at deploy time). A configured-but-missing directory logs a
    // warning and falls back to WebRootPath; the SPA fallback then surfaces
    // a diagnostic 404 if index.html is also absent.
    var spaSettings = app.Services
        .GetRequiredService<Microsoft.Extensions.Options.IOptions<BffSpaSettings>>()
        .Value;
    if (!string.IsNullOrWhiteSpace(spaSettings.StaticRoot))
    {
        var resolvedRoot = SpaStaticHosting.ResolveStaticRoot(app.Environment, spaSettings.StaticRoot);
        if (Directory.Exists(resolvedRoot))
        {
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(resolvedRoot),
            });
        }
        else
        {
            Log.Warning(
                "BFF SPA StaticRoot '{Root}' does not exist on disk; falling back to WebRootPath. Run `npm run watch` in ClientApp/ to populate the directory.",
                resolvedRoot);
            app.UseStaticFiles();
        }
    }
    else
    {
        app.UseStaticFiles();
    }
    app.UseRouting();

    app.UseCors(BffCorsSetup.PolicyName);

    // Edge rate limiter — runs before auth so unauthenticated abusers get
    // 429'd before they ever touch the OIDC pipeline. OIDC callback paths
    // (signin-oidc / signout-callback-oidc) are exempted in BffRateLimiterSetup.
    app.UseRateLimiter();

    app.UseAuthentication();
    app.UseAuthorization();

    // Health endpoints (anonymous — load balancers don't need credentials).
    app.MapBffHealthEndpoints();

    app.MapControllers();

    // SPA fallback — serves index.html for any unmatched route so Angular's
    // client-side router can resolve it. Must be the LAST endpoint
    // registration so it only catches what nothing else claimed.
    app.MapSpaFallback();

    Log.Information("Enterprise.Platform.Web.UI (BFF) starting — environment={Environment}.", app.Environment.EnvironmentName);
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
