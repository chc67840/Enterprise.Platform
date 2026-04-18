using System.Globalization;

namespace Enterprise.Platform.Shared.Extensions;

/// <summary>
/// Date/time helpers used for audit logging, scheduling, and API serialization. All
/// helpers assume UTC unless explicitly noted — the platform treats local-kind values
/// as an error at boundaries.
/// </summary>
public static class DateTimeExtensions
{
    /// <summary>
    /// Serializes to ISO-8601 with milliseconds and a trailing <c>Z</c>. Converts
    /// <see cref="DateTimeKind.Unspecified"/> to UTC (assumption) and <see cref="DateTimeKind.Local"/>
    /// via <see cref="DateTime.ToUniversalTime"/>.
    /// </summary>
    public static string ToUtcIso8601(this DateTime value)
    {
        var utc = value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        };

        return utc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture);
    }

    /// <summary>Returns midnight (00:00:00.000) of <paramref name="value"/>'s date, preserving <see cref="DateTime.Kind"/>.</summary>
    public static DateTime StartOfDay(this DateTime value)
        => DateTime.SpecifyKind(value.Date, value.Kind);

    /// <summary>
    /// Returns the last representable tick of <paramref name="value"/>'s date
    /// (23:59:59.9999999), preserving <see cref="DateTime.Kind"/>. Prefer this over
    /// "<c>start + 1 day</c>" comparisons in SQL to avoid off-by-one bugs across DST.
    /// </summary>
    public static DateTime EndOfDay(this DateTime value)
        => DateTime.SpecifyKind(value.Date.AddDays(1).AddTicks(-1), value.Kind);

    /// <summary>
    /// Returns <c>true</c> when the value sits inside the inclusive range
    /// <c>[<paramref name="start"/>, <paramref name="end"/>]</c>. Throws when <paramref name="start"/>
    /// is after <paramref name="end"/>.
    /// </summary>
    public static bool IsBetween(this DateTime value, DateTime start, DateTime end)
    {
        if (start > end)
        {
            throw new ArgumentException("start must be on or before end.", nameof(start));
        }

        return value >= start && value <= end;
    }
}
