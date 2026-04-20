using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Infrastructure.Configuration.Validation;

/// <summary>
/// Cross-property validator for <see cref="DatabaseSettings"/>. Ensures
/// <see cref="DatabaseSettings.DefaultConnection"/> references a key in
/// <see cref="DatabaseSettings.Connections"/> and that every entry has a
/// <see cref="DatabaseConnectionSettings.ConnectionStringName"/>.
/// </summary>
public sealed class DatabaseSettingsValidator : IValidateOptions<DatabaseSettings>
{
    /// <inheritdoc />
    public ValidateOptionsResult Validate(string? name, DatabaseSettings options)
    {
        ArgumentNullException.ThrowIfNull(options);

        var errors = new List<string>();

        if (!string.IsNullOrWhiteSpace(options.DefaultConnection)
            && !options.Connections.ContainsKey(options.DefaultConnection))
        {
            errors.Add(
                $"DatabaseSettings.DefaultConnection='{options.DefaultConnection}' is not a key in Connections. " +
                $"Known keys: [{string.Join(", ", options.Connections.Keys)}].");
        }

        foreach (var (key, connection) in options.Connections)
        {
            if (string.IsNullOrWhiteSpace(connection.ConnectionStringName))
            {
                errors.Add($"DatabaseSettings.Connections['{key}'].ConnectionStringName is required.");
            }

            if (connection.CommandTimeoutSeconds < 0)
            {
                errors.Add($"DatabaseSettings.Connections['{key}'].CommandTimeoutSeconds must be >= 0; got {connection.CommandTimeoutSeconds}.");
            }
        }

        return errors.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(errors);
    }
}
