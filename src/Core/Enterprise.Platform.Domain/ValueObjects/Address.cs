using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Domain.ValueObjects;

/// <summary>
/// Structured postal address. Kept deliberately simple — the platform does not yet
/// model country-specific formatting rules. Downstream services that need stricter
/// postal validation should layer a specialised value object on top.
/// </summary>
public sealed class Address : ValueObject
{
    private Address(string street, string city, string? region, string postalCode, string country)
    {
        Street = street;
        City = city;
        Region = region;
        PostalCode = postalCode;
        Country = country;
    }

    /// <summary>Primary street address line (house number + street).</summary>
    public string Street { get; }

    /// <summary>City / locality.</summary>
    public string City { get; }

    /// <summary>State / province / region. Optional — not every country uses one.</summary>
    public string? Region { get; }

    /// <summary>Postal / ZIP code.</summary>
    public string PostalCode { get; }

    /// <summary>ISO 3166-1 alpha-2 country code (e.g. <c>"US"</c>, <c>"CA"</c>).</summary>
    public string Country { get; }

    /// <summary>Builds an <see cref="Address"/> after trimming and validating required fields.</summary>
    public static Result<Address> Create(
        string? street,
        string? city,
        string? postalCode,
        string? country,
        string? region = null)
    {
        if (string.IsNullOrWhiteSpace(street))
        {
            return Error.Validation("Street is required.");
        }

        if (string.IsNullOrWhiteSpace(city))
        {
            return Error.Validation("City is required.");
        }

        if (string.IsNullOrWhiteSpace(postalCode))
        {
            return Error.Validation("Postal code is required.");
        }

        if (string.IsNullOrWhiteSpace(country) || country.Length != 2)
        {
            return Error.Validation("Country must be a 2-letter ISO 3166-1 alpha-2 code.");
        }

        return new Address(
            street.Trim(),
            city.Trim(),
            string.IsNullOrWhiteSpace(region) ? null : region.Trim(),
            postalCode.Trim(),
            country.Trim().ToUpperInvariant());
    }

    /// <inheritdoc />
    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Street;
        yield return City;
        yield return Region;
        yield return PostalCode;
        yield return Country;
    }
}
