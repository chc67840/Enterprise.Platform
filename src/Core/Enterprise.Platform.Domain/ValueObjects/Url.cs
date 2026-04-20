using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Domain.ValueObjects;

/// <summary>
/// Validated absolute URL. Wraps <see cref="Uri"/> validation so domain code can
/// accept <see cref="Url"/> parameters knowing the value is well-formed + absolute.
/// Relative URIs, <c>javascript:</c> / <c>data:</c> schemes, and disallowed schemes
/// are rejected at the factory boundary.
/// </summary>
public sealed class Url : ValueObject
{
    private static readonly HashSet<string> AllowedSchemes = new(StringComparer.OrdinalIgnoreCase)
    {
        Uri.UriSchemeHttp,
        Uri.UriSchemeHttps,
    };

    private Url(Uri value) => Value = value;

    /// <summary>Underlying <see cref="Uri"/>.</summary>
    public Uri Value { get; }

    /// <summary>Absolute string form.</summary>
    public string AbsoluteUri => Value.AbsoluteUri;

    /// <summary>Builds a <see cref="Url"/> from raw text. Returns a validation error for invalid / relative / disallowed-scheme URIs.</summary>
    public static Result<Url> Create(string? raw, IReadOnlySet<string>? allowedSchemes = null)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Error.Validation("URL cannot be empty.");
        }

        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri))
        {
            return Error.Validation($"'{raw}' is not an absolute URL.");
        }

        var schemes = allowedSchemes ?? AllowedSchemes;
        if (!schemes.Contains(uri.Scheme))
        {
            return Error.Validation($"URL scheme '{uri.Scheme}' is not allowed.");
        }

        return new Url(uri);
    }

    /// <inheritdoc />
    public override string ToString() => Value.AbsoluteUri;

    /// <inheritdoc />
    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value.AbsoluteUri;
    }
}
