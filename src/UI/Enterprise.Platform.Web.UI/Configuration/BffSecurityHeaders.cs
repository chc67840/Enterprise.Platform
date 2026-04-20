namespace Enterprise.Platform.Web.UI.Configuration;

/// <summary>
/// Security header middleware for the BFF. Similar to the Api's headers but tuned
/// for a page-serving host: CSP is stricter (blocks inline scripts/styles unless
/// whitelisted), <c>X-Frame-Options: SAMEORIGIN</c> lets the SPA embed its own
/// widgets without opening a clickjacking hole against third-party frames.
/// </summary>
public static class BffSecurityHeaders
{
    /// <summary>Registers the header-writing middleware.</summary>
    public static IApplicationBuilder UseBffSecurityHeaders(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        return app.Use(async (context, next) =>
        {
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;

                headers["X-Content-Type-Options"] = "nosniff";
                headers["X-Frame-Options"] = "SAMEORIGIN";
                headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
                headers["Permissions-Policy"] =
                    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";
                headers["X-Permitted-Cross-Domain-Policies"] = "none";

                if (context.Request.IsHttps)
                {
                    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
                }

                // SPA-friendly CSP. Tighten per-deployment: remove 'unsafe-inline' once
                // the SPA's build pipeline emits hashed script tags / uses nonces.
                headers["Content-Security-Policy"] =
                    "default-src 'self'; " +
                    "img-src 'self' data: https:; " +
                    "style-src 'self' 'unsafe-inline'; " +
                    "script-src 'self'; " +
                    "connect-src 'self'; " +
                    "frame-ancestors 'self'; " +
                    "base-uri 'self'; " +
                    "object-src 'none'";

                return Task.CompletedTask;
            });

            await next().ConfigureAwait(false);
        });
    }
}
