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

    /// <inheritdoc />
    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Start;
        yield return End;
    }
}
