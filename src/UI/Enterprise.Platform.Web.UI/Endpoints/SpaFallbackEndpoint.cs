using Enterprise.Platform.Web.UI.Configuration;

namespace Enterprise.Platform.Web.UI.Endpoints;

/// <summary>
/// Endpoint + path-resolution helpers for serving the Angular SPA from a
/// filesystem root. Companion to <see cref="SpaHostingSettings"/>.
/// </summary>
public static class SpaFallbackEndpoint
{
    /// <summary>
    /// Resolves <see cref="SpaHostingSettings.StaticRoot"/> to an absolute path.
    /// Empty / whitespace input falls back to <see cref="IWebHostEnvironment.WebRootPath"/>
    /// (the standard <c>wwwroot/</c> deployment layout). Relative paths
    /// resolve against <see cref="IWebHostEnvironment.ContentRootPath"/> —
    /// keeping the canonical "Web.UI project root" as the anchor regardless
    /// of the current working directory at launch.
    /// </summary>
    public static string ResolveStaticRoot(IWebHostEnvironment env, string configured)
    {
        ArgumentNullException.ThrowIfNull(env);

        if (string.IsNullOrWhiteSpace(configured))
        {
            return env.WebRootPath;
        }

        return Path.IsPathRooted(configured)
            ? configured
            : Path.GetFullPath(Path.Combine(env.ContentRootPath, configured));
    }

    /// <summary>
    /// Registers the SPA fallback endpoint. Any request not matched by
    /// controllers, OIDC middleware, or static-file serving falls through
    /// here and gets <c>index.html</c> served from
    /// <see cref="SpaHostingSettings.StaticRoot"/> (or <c>WebRootPath</c>
    /// when unset). Angular's client-side router then resolves the URL.
    /// </summary>
    /// <remarks>
    /// IMPORTANT: the single-arg <c>MapFallback</c> overload uses the
    /// <c>{*path:nonfile}</c> route constraint which excludes any path that
    /// looks like a file (i.e. has a <c>.</c> in the last segment). For an
    /// SPA whose router emits paths like <c>/users/123/edit.preview</c>
    /// we explicitly want ALL unmatched paths to fall through. The two-arg
    /// overload with <c>{**catchAll}</c> keeps the fallback-order semantics
    /// (runs last via <c>Order = int.MaxValue</c>) without the constraint.
    /// </remarks>
    public static void MapSpaFallback(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        endpoints.MapFallback("/{**catchAll}", async context =>
        {
            // Defence in depth — API + OIDC paths are owned by their controllers
            // / middleware. Returning 404 for obvious path prefixes prevents
            // accidentally serving index.html for an unhandled API call (which
            // would confuse SPA HTTP error handling).
            var path = context.Request.Path.Value ?? string.Empty;
            if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase) ||
                path.StartsWith("/signin-oidc", StringComparison.OrdinalIgnoreCase) ||
                path.StartsWith("/signout-callback-oidc", StringComparison.OrdinalIgnoreCase) ||
                path.StartsWith("/health/", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            var settings = context.RequestServices
                .GetRequiredService<Microsoft.Extensions.Options.IOptionsMonitor<SpaHostingSettings>>()
                .CurrentValue;
            var env = context.RequestServices.GetRequiredService<IWebHostEnvironment>();

            var rootPath = ResolveStaticRoot(env, settings.StaticRoot);
            var indexPath = Path.Combine(rootPath, "index.html");
            if (!File.Exists(indexPath))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                await context.Response.WriteAsync(
                    $"SPA index.html not found at '{indexPath}'. Run `npm run watch` in ClientApp/, or copy a production build into '{env.WebRootPath}'.",
                    context.RequestAborted).ConfigureAwait(false);
                return;
            }

            context.Response.ContentType = "text/html; charset=utf-8";
            await context.Response.SendFileAsync(indexPath, context.RequestAborted).ConfigureAwait(false);
        });
    }
}
