using Enterprise.Platform.Web.UI.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Web.UI.Services.HealthChecks;

/// <summary>
/// Probes the downstream Api by issuing a 3-second-timeout GET against its
/// <c>/health/live</c>. Anonymous — the Api's own health endpoints are
/// anonymous too so the probe doesn't require a token.
/// </summary>
internal sealed class DownstreamApiHealthCheck(
    IHttpClientFactory httpClientFactory,
    IOptionsMonitor<ProxySettings> settings) : IHealthCheck
{
    /// <summary>Named HTTP client used for the downstream Api liveness probe.</summary>
    public const string HttpClientName = "ep-health-probe";

    private readonly IHttpClientFactory _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
    private readonly IOptionsMonitor<ProxySettings> _settings = settings ?? throw new ArgumentNullException(nameof(settings));

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var apiBase = new Uri(_settings.CurrentValue.ApiBaseUri);
            // ApiBaseUri ends in `/api/`; the Api's health endpoint sits at the host root.
            var probeTarget = new Uri(apiBase, "/health/live");

            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(timeout.Token, cancellationToken);
            using var client = _httpClientFactory.CreateClient(HttpClientName);
            using var response = await client.GetAsync(probeTarget, linked.Token).ConfigureAwait(false);

            return response.IsSuccessStatusCode
                ? HealthCheckResult.Healthy($"Downstream Api reachable at {probeTarget}.")
                : HealthCheckResult.Degraded($"Downstream Api at {probeTarget} returned {(int)response.StatusCode}.");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return HealthCheckResult.Degraded("Downstream Api probe timed out (3s).");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Downstream Api probe threw.", ex);
        }
    }
}
