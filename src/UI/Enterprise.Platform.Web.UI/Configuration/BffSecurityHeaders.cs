using System.Buffers;
using System.Security.Cryptography;

namespace Enterprise.Platform.Web.UI.Configuration;

/// <summary>
/// Security header middleware for the BFF. Replaces the SPA's old <c>&lt;meta
/// http-equiv=&quot;Content-Security-Policy&quot;&gt;</c> with a header-delivered
/// CSP that carries a per-request nonce, so future inline-script use can opt in
/// with <c>&lt;script nonce=&quot;@(Context.Items[&quot;ep.csp.nonce&quot;])&quot;&gt;</c>
/// without relaxing the policy globally. Today's Angular bundle has no inline
/// scripts, so the nonce stays unused — its presence is the difference between
/// a strict policy that's safe for inline injection later and one that requires
/// re-architecture when that need arises.
/// </summary>
public static class BffSecurityHeaders
{
    /// <summary>
    /// HttpContext.Items key for the per-request nonce. Page-rendering paths
    /// inject this onto inline <c>&lt;script&gt;</c> tags they emit; the
    /// header-delivered CSP whitelists the same nonce in <c>script-src</c>.
    /// </summary>
    public const string NonceItemKey = "ep.csp.nonce";

    /// <summary>
    /// Length (bytes) of the per-request nonce before base64 encoding. 16 bytes
    /// = 128 bits of entropy ≫ the CSP-spec minimum recommendation of 128 bits.
    /// </summary>
    private const int NonceByteLength = 16;

    /// <summary>Registers the header-writing middleware.</summary>
    public static IApplicationBuilder UseBffSecurityHeaders(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var env = app.ApplicationServices.GetRequiredService<IWebHostEnvironment>();
        var isDevelopment = env.IsDevelopment();

        return app.Use(async (context, next) =>
        {
            var nonce = MintNonce();
            context.Items[NonceItemKey] = nonce;

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

                // Header-delivered CSP (Phase 9.B.10). Tighter than the old
                // <meta>-tag policy because:
                //   • `script-src 'self' 'nonce-{N}'` — only same-origin
                //     scripts + any inline script carrying our nonce. Angular's
                //     emitted bundles already use `<script src=...>` so they
                //     match `'self'`; nonce stays available for future use.
                //   • `style-src 'self' 'unsafe-inline'` — kept for now because
                //     PrimeNG's runtime theme engine injects <style> nodes.
                //     Removing it requires PrimeNG's CSP nonce mode (a separate
                //     migration; tracked as a follow-up).
                //   • `frame-ancestors 'self'` — works correctly when emitted
                //     as a header (was ignored when emitted via <meta>).
                //   • `connect-src 'self'` (prod) — entire surface is
                //     same-origin since the SPA proxies through the BFF.
                //   • `connect-src` (dev) — adds `ws://localhost:*`,
                //     `wss://localhost:*`, and `http://localhost:*` so VS's
                //     dev tooling (aspnetcore-browser-refresh hot-reload
                //     WebSocket + BrowserLink SignalR) can connect on its
                //     dynamic ports. Dev-only relaxation; never reaches
                //     staging/prod.
                var connectSrc = isDevelopment
                    ? "connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:*; "
                    : "connect-src 'self'; ";

                headers["Content-Security-Policy"] =
                    "default-src 'self'; " +
                    $"script-src 'self' 'nonce-{nonce}'; " +
                    "style-src 'self' 'unsafe-inline'; " +
                    "img-src 'self' data: https:; " +
                    "font-src 'self' data:; " +
                    connectSrc +
                    "frame-ancestors 'self'; " +
                    "base-uri 'self'; " +
                    "form-action 'self'; " +
                    "object-src 'none'";

                return Task.CompletedTask;
            });

            await next().ConfigureAwait(false);
        });
    }

    /// <summary>
    /// Generates a fresh CSP nonce. Cryptographically random, base64-encoded
    /// (URL-safe is unnecessary — CSP grammar accepts standard base64).
    /// </summary>
    private static string MintNonce()
    {
        var buffer = ArrayPool<byte>.Shared.Rent(NonceByteLength);
        try
        {
            RandomNumberGenerator.Fill(buffer.AsSpan(0, NonceByteLength));
            return Convert.ToBase64String(buffer, 0, NonceByteLength);
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }
}
