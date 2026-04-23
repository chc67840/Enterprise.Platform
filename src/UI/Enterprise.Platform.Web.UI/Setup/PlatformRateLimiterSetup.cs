using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Enterprise.Platform.Web.UI.Setup;

/// <summary>
/// Edge rate limiting for the Web.UI host. Two partitioned token-bucket policies:
/// <list type="bullet">
///   <item><b>per-session</b> — keyed by the session-cookie value (or remote
///         IP for anonymous traffic). Throttles a single user's burst
///         independently of others. 120 requests / minute, replenishing 2/sec.</item>
///   <item><b>per-IP</b> — keyed by remote IP. Defense in depth against a
///         single host abusing many sessions. 600 / minute, replenishing 10/sec.</item>
/// </list>
/// Both run as a chained policy; either bucket exhausting returns 429.
/// The Api has its own global / per-tenant / per-user limiter — this is
/// strictly the edge layer. OIDC callback paths are exempted so a slow
/// browser network round-trip can't get throttled mid-handshake.
/// </summary>
public static class PlatformRateLimiterSetup
{
    /// <summary>Policy name used by <c>UseRateLimiter</c> + endpoint conventions.</summary>
    public const string PolicyName = "ep-edge";

    private static readonly HashSet<string> ExemptPathPrefixes = new(StringComparer.OrdinalIgnoreCase)
    {
        "/signin-oidc",
        "/signout-callback-oidc",
        "/health/live",
        "/health/ready",
    };

    /// <summary>Registers the host's edge rate limiter.</summary>
    public static IServiceCollection AddPlatformRateLimiter(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.OnRejected = async (ctx, cancellationToken) =>
            {
                if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retry))
                {
                    ctx.HttpContext.Response.Headers.RetryAfter =
                        ((int)retry.TotalSeconds).ToString(CultureInfo.InvariantCulture);
                }
                ctx.HttpContext.Response.ContentType = "application/json";
                await ctx.HttpContext.Response.WriteAsync(
                    """{"title":"Too many requests","detail":"Edge rate limit exceeded; retry after the time in the Retry-After header."}""",
                    cancellationToken).ConfigureAwait(false);
            };

            options.GlobalLimiter = PartitionedRateLimiter.CreateChained(
                // Per-session bucket (keyed by session cookie when present,
                // remote IP otherwise so anonymous traffic still gets bucketed).
                PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
                {
                    if (ShouldSkip(ctx))
                    {
                        return RateLimitPartition.GetNoLimiter("bypass");
                    }

                    var sessionKey = ctx.Request.Cookies["ep.bff.session"]
                        ?? $"ip:{ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";

                    return RateLimitPartition.GetTokenBucketLimiter(sessionKey, _ => new TokenBucketRateLimiterOptions
                    {
                        TokenLimit = 120,
                        ReplenishmentPeriod = TimeSpan.FromSeconds(1),
                        TokensPerPeriod = 2,
                        QueueLimit = 0,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        AutoReplenishment = true,
                    });
                }),

                // Per-IP bucket — coarser, broader cap.
                PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
                {
                    if (ShouldSkip(ctx))
                    {
                        return RateLimitPartition.GetNoLimiter("bypass");
                    }

                    var ipKey = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                    return RateLimitPartition.GetTokenBucketLimiter($"ip:{ipKey}", _ => new TokenBucketRateLimiterOptions
                    {
                        TokenLimit = 600,
                        ReplenishmentPeriod = TimeSpan.FromSeconds(1),
                        TokensPerPeriod = 10,
                        QueueLimit = 0,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        AutoReplenishment = true,
                    });
                }));
        });

        return services;
    }

    private static bool ShouldSkip(HttpContext ctx)
    {
        var path = ctx.Request.Path.Value ?? string.Empty;
        foreach (var exempt in ExemptPathPrefixes)
        {
            if (path.StartsWith(exempt, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }
}
