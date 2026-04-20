using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Infrastructure.Configuration.Validation;

/// <summary>
/// Fail-fast options binding. Binds from <paramref name="configuration"/>, applies
/// DataAnnotations, runs any registered <see cref="IValidateOptions{TOptions}"/>
/// validators, and <b>aborts host startup</b> if validation fails. Consumers never
/// see a half-valid settings instance at runtime.
/// </summary>
/// <remarks>
/// The <c>.ValidateOnStart()</c> call is what flips validation from lazy (on first
/// <c>IOptions&lt;T&gt;</c> resolution) to eager (at host build). Without it, an
/// invalid config only surfaces when the first request arrives — often after the
/// healthcheck has already reported Healthy.
/// </remarks>
public static class ValidatedOptionsExtensions
{
    /// <summary>Registers <typeparamref name="TOptions"/> with DataAnnotations + ValidateOnStart.</summary>
    public static OptionsBuilder<TOptions> AddValidatedOptions<TOptions>(
        this IServiceCollection services,
        IConfiguration configuration,
        string sectionName)
        where TOptions : class
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentException.ThrowIfNullOrWhiteSpace(sectionName);

        return services.AddOptions<TOptions>()
            .Bind(configuration.GetSection(sectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();
    }
}
