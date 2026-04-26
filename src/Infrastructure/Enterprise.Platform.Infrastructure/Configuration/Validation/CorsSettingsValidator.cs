using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Infrastructure.Configuration.Validation;

/// <summary>
/// Validates <see cref="CorsSettings"/> against P2-7 audit hardening:
/// rejects wildcard (<c>"*"</c>) entries in the headers / methods allowlists.
/// CORS wildcards in production-facing configs widen the attack surface for
/// header-injection / verb-tampering exploits — every header / method must be
/// explicit.
/// </summary>
/// <remarks>
/// Origins are kept narrow per environment via the deployment pipeline; this
/// validator focuses on headers + methods because they're the most commonly
/// over-permissive areas in inherited configs. <c>AllowCredentials = true</c>
/// without specific origins is also rejected (the browser ignores it but the
/// intent is footgun-grade).
/// </remarks>
public sealed class CorsSettingsValidator : IValidateOptions<CorsSettings>
{
    /// <inheritdoc />
    public ValidateOptionsResult Validate(string? name, CorsSettings options)
    {
        ArgumentNullException.ThrowIfNull(options);

        var errors = new List<string>();

        if (options.AllowedHeaders.Any(h => h == "*"))
        {
            errors.Add(
                "Cors.AllowedHeaders contains \"*\" — wildcard headers are forbidden " +
                "(P2-7 audit). Enumerate the explicit headers required (Accept, " +
                "Content-Type, Authorization, X-Correlation-ID, X-Idempotency-Key, " +
                "X-XSRF-TOKEN, etc.).");
        }

        if (options.AllowedMethods.Any(m => m == "*"))
        {
            errors.Add(
                "Cors.AllowedMethods contains \"*\" — wildcard methods are forbidden. " +
                "Enumerate the explicit verbs required (GET, POST, PUT, PATCH, DELETE, OPTIONS).");
        }

        if (options.AllowedOrigins.Any(o => o == "*"))
        {
            errors.Add(
                "Cors.AllowedOrigins contains \"*\" — wildcard origins disable CORS " +
                "protection entirely. Enumerate explicit origins per environment.");
        }

        if (options.AllowCredentials && options.AllowedOrigins.Count == 0)
        {
            errors.Add(
                "Cors.AllowCredentials is true but Cors.AllowedOrigins is empty. " +
                "Browsers ignore credentialed requests when the origin allowlist is " +
                "empty; this combination is a configuration error.");
        }

        return errors.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(errors);
    }
}
