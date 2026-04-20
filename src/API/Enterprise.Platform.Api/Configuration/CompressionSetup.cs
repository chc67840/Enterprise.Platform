using System.IO.Compression;
using Microsoft.AspNetCore.ResponseCompression;

namespace Enterprise.Platform.Api.Configuration;

/// <summary>
/// Enables response compression (Brotli + Gzip) for typical JSON / text responses.
/// HTTPS compression is enabled — the security trade-off (BREACH) is accepted
/// because responses are authenticated API payloads, not user-secret HTML forms.
/// </summary>
public static class CompressionSetup
{
    /// <summary>Registers compression providers and tuned options.</summary>
    public static IServiceCollection AddPlatformCompression(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddResponseCompression(options =>
        {
            options.EnableForHttps = true;
            options.Providers.Add<BrotliCompressionProvider>();
            options.Providers.Add<GzipCompressionProvider>();
            options.MimeTypes =
            [
                "application/json",
                "application/problem+json",
                "application/xml",
                "text/plain",
                "text/css",
                "text/html",
                "text/xml",
                "text/json",
            ];
        });

        services.Configure<BrotliCompressionProviderOptions>(opts => opts.Level = CompressionLevel.Fastest);
        services.Configure<GzipCompressionProviderOptions>(opts => opts.Level = CompressionLevel.Fastest);

        return services;
    }
}
