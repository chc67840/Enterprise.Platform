namespace Enterprise.Platform.Shared.Constants;

/// <summary>
/// Application-wide numeric constants. Centralized so that string/column lengths,
/// pagination bounds, and timeouts stay consistent across the Domain, Contracts,
/// Application, and UI tiers.
/// </summary>
public static class AppConstants
{
    /// <summary>String length limits used by DTOs, EF configurations, and FluentValidation rules.</summary>
    public static class StringLengths
    {
        /// <summary>Short names (titles, labels). Matches typical <c>NVARCHAR(100)</c> columns.</summary>
        public const int Name = 100;

        /// <summary>Longer descriptive names (e.g. legal/full names).</summary>
        public const int LongName = 256;

        /// <summary>Email addresses — RFC 5321 practical max.</summary>
        public const int Email = 320;

        /// <summary>E.164 phone numbers including a leading <c>+</c>.</summary>
        public const int Phone = 32;

        /// <summary>URLs / URIs. Matches typical <c>NVARCHAR(2048)</c> columns.</summary>
        public const int Url = 2048;

        /// <summary>Short, human-readable descriptions.</summary>
        public const int Description = 1000;

        /// <summary>Free-form narrative text.</summary>
        public const int Narrative = 4000;
    }

    /// <summary>Pagination bounds used by offset and cursor pagination.</summary>
    public static class Paging
    {
        /// <summary>Default page size when the caller omits one.</summary>
        public const int DefaultPageSize = 25;

        /// <summary>Maximum page size a caller may request — cap to protect the DB and network.</summary>
        public const int MaxPageSize = 200;

        /// <summary>Default page index (1-based).</summary>
        public const int DefaultPageNumber = 1;
    }

    /// <summary>Default timeouts (in seconds) applied when a caller does not override.</summary>
    public static class Timeouts
    {
        /// <summary>Default database command timeout — overridable per <c>DatabaseSettings</c> entry.</summary>
        public const int DatabaseCommandSeconds = 30;

        /// <summary>Default outbound HTTP client timeout.</summary>
        public const int HttpClientSeconds = 30;

        /// <summary>Default distributed-cache read/write timeout.</summary>
        public const int CacheOperationSeconds = 5;
    }

    /// <summary>Auth / identity token lifetimes (minutes unless otherwise noted).</summary>
    public static class Auth
    {
        /// <summary>Default access-token lifetime — short-lived by design.</summary>
        public const int AccessTokenMinutes = 15;

        /// <summary>Default refresh-token lifetime.</summary>
        public const int RefreshTokenDays = 14;
    }
}
