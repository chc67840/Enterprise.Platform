using System.Threading.RateLimiting;
using Enterprise.Platform.Contracts.Settings;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using ClaimTypes = Enterprise.Platform.Shared.Constants.ClaimTypes;
using HttpHeaderNames = Enterprise.Platform.Shared.Constants.HttpHeaderNames;

namespace Enterprise.Platform.Api.Configuration;

/// <summary>
/// Wires ASP.NET Core rate limiting from <see cref="RateLimitSettings"/>. Three
/// fixed-window limiters compose in order: global → per-tenant → per-user. The first
/// that rejects short-circuits the pipeline with a 429 carrying
/// <c>Retry-After</c> when <see cref="RateLimitSettings.EmitRetryAfterHeader"/> is on.
/// </summary>
public static class RateLimitingSetup
{
    /// <summary>Policy name for the combined limiter.</summary>
    public const string PolicyName = "ep-standard";

    /// <summary>Registers the rate limiter + <see cref="PolicyName"/> policy.</summary>
    public static IServiceCollection AddPlatformRateLimiting(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddRateLimiter(options =>
        {
            options.GlobalLimiter = PartitionedRateLimiter.CreateChained(
                PartitionedRateLimiter.Create<HttpContext, string>(context =>
                {
                    var settings = context.RequestServices.GetRequiredService<IOptions<RateLimitSettings>>().Value;
                    return settings.GlobalPermitsPerWindow <= 0
                        ? RateLimitPartition.GetNoLimiter("global")
                        : RateLimitPartition.GetFixedWindowLimiter("global", _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = settings.GlobalPermitsPerWindow,
                            Window = settings.Window,
                            QueueLimit = settings.QueueLimit,
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        });
                }),
                PartitionedRateLimiter.Create<HttpContext, string>(context =>
                {
                    var settings = context.RequestServices.GetRequiredService<IOptions<RateLimitSettings>>().Value;
                    var tenantId = context.Request.Headers[HttpHeaderNames.TenantId].ToString();
                    if (string.IsNullOrWhiteSpace(tenantId) || settings.PerTenantPermitsPerWindow <= 0)
                    {
                        return RateLimitPartition.GetNoLimiter("tenant-none");
                    }

                    return RateLimitPartition.GetFixedWindowLimiter(
                        $"tenant:{tenantId}",
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = settings.PerTenantPermitsPerWindow,
                            Window = settings.Window,
                            QueueLimit = settings.QueueLimit,
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        });
                }),
                PartitionedRateLimiter.Create<HttpContext, string>(context =>
                {
                    var settings = context.RequestServices.GetRequiredService<IOptions<RateLimitSettings>>().Value;
                    var userId = context.User?.FindFirst(ClaimTypes.UserId)?.Value;
                    if (string.IsNullOrWhiteSpace(userId) || settings.PerUserPermitsPerWindow <= 0)
                    {
                        return RateLimitPartition.GetNoLimiter("user-anonymous");
                    }

                    return RateLimitPartition.GetFixedWindowLimiter(
                        $"user:{userId}",
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = settings.PerUserPermitsPerWindow,
                            Window = settings.Window,
                            QueueLimit = settings.QueueLimit,
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        });
                }));

            options.OnRejected = async (context, token) =>
            {
                var opts = context.HttpContext.RequestServices.GetRequiredService<IOptions<RateLimitSettings>>().Value;
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

                if (opts.EmitRetryAfterHeader && context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString(System.Globalization.CultureInfo.InvariantCulture);
                }

                await context.HttpContext.Response.WriteAsync("Too many requests.", token).ConfigureAwait(false);
            };
        });

        return services;
    }
}
