using Enterprise.Platform.Api.Endpoints.v1;
using Enterprise.Platform.Api.Endpoints.v1.EventShopper;
using Enterprise.Platform.Api.Middleware;

namespace Enterprise.Platform.Api.Extensions;

/// <summary>
/// Middleware ordering is as consequential as it is fragile — this helper keeps
/// the sequence in one place so <c>Program.cs</c> stays declarative. Ordering rule
/// of thumb: correlation / security / exception → routing / CORS → auth → tenant
/// → rate-limit → endpoints.
/// </summary>
public static class WebApplicationExtensions
{
    /// <summary>Wires the HTTP request pipeline and endpoint map.</summary>
    public static WebApplication UsePlatformPipeline(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);

        // Outer → inner order:
        app.UseMiddleware<CorrelationIdMiddleware>();
        app.UseMiddleware<SecurityHeadersMiddleware>();
        app.UseMiddleware<GlobalExceptionMiddleware>();
        app.UseMiddleware<RequestLoggingMiddleware>();

        app.UseResponseCompression();

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi("/openapi/{documentName}.json");
        }

        // HTTPS redirection is skipped in Development because:
        //   (a) The dev SPA calls `http://localhost:5044` — a 307 redirect to
        //       the HTTPS port breaks the CORS preflight (browsers refuse to
        //       follow redirects on OPTIONS requests, blocking the whole call).
        //   (b) Production sits behind an L7 load balancer / reverse proxy that
        //       terminates TLS and enforces HTTPS upstream; the app-layer
        //       redirect would be redundant there anyway.
        if (!app.Environment.IsDevelopment())
        {
            app.UseHttpsRedirection();
        }

        app.UseCors();

        app.UseAuthentication();
        app.UseAuthorization();

        app.UseMiddleware<TenantResolutionMiddleware>();

        app.UseRateLimiter();

        // Endpoints
        app.MapHealthEndpoints();
        app.MapWhoAmI();
        app.MapRolesEndpoints();

        return app;
    }
}
