namespace Enterprise.Platform.Api.Middleware;

/// <summary>
/// Applies standard browser-protection headers to every response. Values are
/// deliberately conservative; lock-down environments should tighten further via
/// host configuration rather than loosening these defaults. Headers are set before
/// the response body is written so browsers see them even on errors.
/// </summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    private readonly RequestDelegate _next = next ?? throw new ArgumentNullException(nameof(next));

    /// <summary>Invokes the pipeline after attaching the security headers.</summary>
    public Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;

            headers["X-Content-Type-Options"] = "nosniff";
            headers["X-Frame-Options"] = "DENY";
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            headers["Permissions-Policy"] = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";
            headers["X-Permitted-Cross-Domain-Policies"] = "none";

            if (context.Request.IsHttps)
            {
                headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
            }

            // Baseline CSP — tighten per-host. Blocks inline scripts/styles by default.
            headers["Content-Security-Policy"] =
                "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'";

            return Task.CompletedTask;
        });

        return _next(context);
    }
}
