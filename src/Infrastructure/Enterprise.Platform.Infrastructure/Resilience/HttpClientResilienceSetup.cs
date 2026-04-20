using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http.Resilience;

namespace Enterprise.Platform.Infrastructure.Resilience;

/// <summary>
/// Composition helper that wires a named <c>HttpClient</c> with the
/// Microsoft.Extensions.Http.Resilience standard handler (retry + circuit-breaker +
/// timeout + rate-limiter). Callers provide the name + base address; the handler
/// defaults are tuned for transient network failures.
/// </summary>
public static class HttpClientResilienceSetup
{
    /// <summary>Adds a resilient named <c>HttpClient</c> pointing at <paramref name="baseAddress"/>.</summary>
    public static IHttpClientBuilder AddResilientHttpClient(
        this IServiceCollection services,
        string clientName,
        Uri baseAddress,
        Action<HttpStandardResilienceOptions>? configure = null)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentException.ThrowIfNullOrWhiteSpace(clientName);
        ArgumentNullException.ThrowIfNull(baseAddress);

        var builder = services.AddHttpClient(clientName, client =>
        {
            client.BaseAddress = baseAddress;
        });

        builder.AddStandardResilienceHandler(options =>
        {
            configure?.Invoke(options);
        });

        return builder;
    }
}
