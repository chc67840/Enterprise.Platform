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

    // BFF composition
    builder.Services.AddBffAuthentication(builder.Configuration);
    builder.Services.AddBffCors(builder.Configuration);

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

    builder.Services.AddControllers();
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
        app.UseExceptionHandler("/Home/Error");
        app.UseHsts();
    }

    app.UseHttpsRedirection();
    app.UseStaticFiles();
    app.UseRouting();

    app.UseCors(BffCorsSetup.PolicyName);

    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();

    // MVC default route (retains the scaffolded Home/Index until the Angular SPA
    // takes over — that wiring lands post-foundation, per the TODO's out-of-scope list).
    app.MapControllerRoute(
        name: "default",
        pattern: "{controller=Home}/{action=Index}/{id?}");

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
