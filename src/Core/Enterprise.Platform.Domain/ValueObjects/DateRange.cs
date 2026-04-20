using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Domain.ValueObjects;

/// <summary>
/// Inclusive date-or-time interval. Used by scheduling, reporting, and eligibility
/// rules across domains. Invariant: <see cref="Start"/> is on or before <see cref="End"/>.
/// </summary>
public sealed class DateRange : ValueObject
{
    private DateRange(DateTimeOffset start, DateTimeOffset end)
    {
        Start = start;
        End = end;
    }

    /// <summary>Inclusive lower bound.</summary>
    public DateTimeOffset Start { get; }

    /// <summary>Inclusive upper bound.</summary>
    public DateTimeOffset End { get; }

    /// <summary>Duration of the interval — always non-negative.</summary>
    public TimeSpan Duration => End - Start;

    /// <summary>Factory. Returns a validation error when <paramref name="start"/> is after <paramref name="end"/>.</summary>
    public static Result<DateRange> Create(DateTimeOffset start, DateTimeOffset end)
    {
        if (start > end)
        {
            return Error.Validation("DateRange start must be on or before end.");
        }

        return new DateRange(start, end);
    }

    /// <summary>Returns <c>true</c> when <paramref name="instant"/> lies inside the inclusive range.</summary>
    public bool Contains(DateTimeOffset instant) => instant >= Start && instant <= End;

    /// <summary>Returns <c>true</c> when this range shares any instant with <paramref name="other"/>.</summary>
    public bool Overlaps(DateRange other)
    {
        ArgumentNullException.ThrowIfNull(other);
        return Start <= other.End && other.Start <= End;
    }

    /// <summary>
    /// Returns a new range clipped to the intersection with
    /// <c>[<paramref name="min"/>, <paramref name="max"/>]</c>. Returns the original
    /// range when it's already inside the bounds; returns a one-instant range when
    /// the intersection is empty (caller should prefer <see cref="Overlaps"/> first).
    /// </summary>
    public DateRange Clamp(DateTimeOffset min, DateTimeOffset max)
    {
        if (min > max)
        {
            throw new ArgumentException("Clamp bounds are inverted (min > max).", nameof(min));
        }

        var clampedStart = Start < min ? min : Start;
        var clampedEnd = End > max ? max : End;
        if (clampedStart > clampedEnd)
        {
            clampedEnd = clampedStart;
        }

        return new DateRange(clampedStart, clampedEnd);
    }

    /// <summary>UTC "today" as a one-day range from midnight to 23:59:59.</summary>
    public static DateRange Today(TimeProvider? timeProvider = null)
    {
        var now = (timeProvider ?? TimeProvider.System).GetUtcNow();
        var startOfDay = new DateTimeOffset(now.Date, TimeSpan.Zero);
        return new DateRange(startOfDay, startOfDay.AddDays(1).AddTicks(-1));
    }

    /// <summary>Range spanning the current UTC calendar month.</summary>
    public static DateRange ThisMonth(TimeProvider? timeProvider = null)
    {
        var now = (timeProvider ?? TimeProvider.System).GetUtcNow();
        var start = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
        var end = start.AddMonths(1).AddTicks(-1);
        return new DateRange(start, end);
    }

    /// <summary>Range covering the last <paramref name="days"/> days ending at "now".</summary>
    public static DateRange LastDays(int days, TimeProvider? timeProvider = null)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(days);
        var now = (timeProvider ?? TimeProvider.System).GetUtcNow();
        return new DateRange(now.AddDays(-days), now);
    }

    /// <inheritdoc />
    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Start;
        yield return End;
    }
}
