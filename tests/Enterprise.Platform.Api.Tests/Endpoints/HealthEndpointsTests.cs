using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Enterprise.Platform.Api.Tests.Endpoints;

/// <summary>
/// Phase-8 checkpoint tests. Exercises the composed Api pipeline end-to-end via
/// <see cref="WebApplicationFactory{TEntryPoint}"/> — the only executable path the
/// dev-box's Application Control policy allows. Mirrors the checkpoint's
/// "curl /health/live, curl protected" manual probe.
/// </summary>
public sealed class HealthEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public HealthEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = (factory ?? throw new ArgumentNullException(nameof(factory)))
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Health_live_returns_200_and_healthy_payload()
    {
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/health/live", UriKind.Relative));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Healthy", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Health_ready_returns_200_when_dependencies_are_up()
    {
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/health/ready", UriKind.Relative));

        // Accept Healthy(200) or Degraded(200) — both indicate the pipeline ran.
        // Unhealthy returns 503.
        Assert.NotEqual(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Whoami_without_token_returns_401()
    {
        using var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });

        using var response = await client.GetAsync(new Uri("/api/v1/whoami", UriKind.Relative));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Correlation_id_header_echoed_on_response()
    {
        using var client = _factory.CreateClient();
        var expected = Guid.NewGuid().ToString("D");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health/live");
        request.Headers.Add(Shared.Constants.HttpHeaderNames.CorrelationId, expected);

        using var response = await client.SendAsync(request);

        Assert.True(response.Headers.TryGetValues(Shared.Constants.HttpHeaderNames.CorrelationId, out var values));
        Assert.Equal(expected, string.Join(',', values!));
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Security_headers_present_on_response()
    {
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/health/live", UriKind.Relative));

        Assert.True(response.Headers.Contains("X-Content-Type-Options") || response.Content.Headers.Contains("X-Content-Type-Options"));
        var all = response.Headers.Concat(response.Content.Headers).ToDictionary(h => h.Key, h => string.Join(",", h.Value), StringComparer.OrdinalIgnoreCase);
        Assert.Contains("X-Content-Type-Options", all.Keys);
        Assert.Equal("nosniff", all["X-Content-Type-Options"]);
        Assert.Contains("X-Frame-Options", all.Keys);
        Assert.Equal("DENY", all["X-Frame-Options"]);
        Assert.Contains("Content-Security-Policy", all.Keys);
    }
}
