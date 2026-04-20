using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Enterprise.Platform.Infrastructure.Common;
using Enterprise.Platform.Shared.Results;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Infrastructure.ExternalServices;

/// <summary>
/// Abstract base for third-party HTTP consumers. Subclasses inject a resilient
/// named <see cref="HttpClient"/> (wired via
/// <see cref="Resilience.HttpClientResilienceSetup"/>) and use the protected helpers
/// to translate 2xx responses into <see cref="Result{T}"/> and 4xx/5xx + network
/// failures into typed <see cref="Error"/>s — no raw exceptions bubble to handlers.
/// </summary>
public abstract class ExternalServiceBase(HttpClient httpClient, ILogger logger)
{
    private static readonly JsonSerializerOptions _defaultJsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>Shared <see cref="HttpClient"/>; base address + headers live on the client.</summary>
    protected HttpClient Client { get; } = httpClient ?? throw new ArgumentNullException(nameof(httpClient));

    /// <summary>Logger for the derived service.</summary>
    protected ILogger Logger { get; } = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <summary>Sends <paramref name="request"/> and deserialises the JSON body into <typeparamref name="T"/>.</summary>
    protected async Task<Result<T>> SendAsync<T>(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        try
        {
            using var response = await Client.SendAsync(request, cancellationToken).ConfigureAwait(false);

            if (response.StatusCode is HttpStatusCode.NotFound)
            {
                return Error.NotFound($"{request.RequestUri} not found.");
            }

            if (!response.IsSuccessStatusCode)
            {
                var detail = await SafeReadAsync(response, cancellationToken).ConfigureAwait(false);
                return MapStatusToError(response.StatusCode, detail);
            }

            var payload = await response.Content
                .ReadFromJsonAsync<T>(_defaultJsonOptions, cancellationToken)
                .ConfigureAwait(false);
            return payload is null
                ? Error.Internal($"{request.RequestUri} returned empty body.")
                : Result.Success(payload);
        }
        catch (HttpRequestException ex)
        {
            Logger.ExternalCallFailed(ex, request.RequestUri);
            return Error.Internal($"Network error calling {request.RequestUri}.");
        }
        catch (TaskCanceledException ex)
        {
            Logger.ExternalCallTimedOut(ex, request.RequestUri);
            return Error.Internal($"Timeout calling {request.RequestUri}.");
        }
    }

    private static Error MapStatusToError(HttpStatusCode status, string detail)
    {
        var code = (int)status;
        return code switch
        {
            >= 500 => Error.Internal($"Upstream 5xx: {detail}"),
            401 => Error.Unauthorized($"Upstream 401: {detail}"),
            403 => Error.Forbidden($"Upstream 403: {detail}"),
            409 => Error.Conflict($"Upstream 409: {detail}"),
            _ => Error.Validation($"Upstream {code}: {detail}"),
        };
    }

    private static async Task<string> SafeReadAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            return await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            return string.Empty;
        }
    }
}
