using Microsoft.Extensions.DependencyInjection;
using Polly;
using Polly.Retry;

namespace Enterprise.Platform.Infrastructure.Resilience;

/// <summary>
/// Standard resilience pipeline for non-HTTP workloads (database, external SDKs,
/// message broker sends). Composed of: retry-with-jitter (3 attempts, exponential
/// backoff) + timeout. Circuit-breaker is intentionally excluded at the global layer —
/// per-dependency breakers should live in the call-site pipeline to avoid blanket
/// impact during partial outages.
/// </summary>
public static class ResiliencePipelineSetup
{
    /// <summary>DI key under which the standard pipeline is registered.</summary>
    public const string StandardPipelineKey = "ep-standard";

    /// <summary>Adds the standard <c>ResiliencePipeline</c> keyed by <see cref="StandardPipelineKey"/>.</summary>
    public static IServiceCollection AddStandardResiliencePipeline(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddResiliencePipeline(StandardPipelineKey, builder =>
        {
            builder
                .AddRetry(new RetryStrategyOptions
                {
                    MaxRetryAttempts = 3,
                    BackoffType = DelayBackoffType.Exponential,
                    UseJitter = true,
                    Delay = TimeSpan.FromMilliseconds(200),
                })
                .AddTimeout(TimeSpan.FromSeconds(30));
        });

        return services;
    }
}
