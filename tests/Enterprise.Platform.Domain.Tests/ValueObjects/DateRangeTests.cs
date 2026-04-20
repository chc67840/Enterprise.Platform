using Enterprise.Platform.Domain.ValueObjects;
using FluentAssertions;

namespace Enterprise.Platform.Domain.Tests.ValueObjects;

/// <summary>
/// Coverage for the scheduling/eligibility primitive <see cref="DateRange"/>. The
/// interesting cases are zero-length ranges, inverted bounds, and overlap detection
/// at the exact-equality boundary (inclusive).
/// </summary>
public sealed class DateRangeTests
{
    private static readonly DateTimeOffset Epoch = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Create_Should_Succeed_When_Start_Before_End()
    {
        var result = DateRange.Create(Epoch, Epoch.AddDays(7));
        result.IsSuccess.Should().BeTrue();
        result.Value.Duration.Should().Be(TimeSpan.FromDays(7));
    }

    [Fact]
    public void Create_Should_Accept_Zero_Length_Range()
    {
        var result = DateRange.Create(Epoch, Epoch);
        result.IsSuccess.Should().BeTrue();
        result.Value.Duration.Should().Be(TimeSpan.Zero);
    }

    [Fact]
    public void Create_Should_Fail_When_Start_After_End()
    {
        var result = DateRange.Create(Epoch.AddDays(2), Epoch);
        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public void Contains_Should_Be_Inclusive_On_Both_Ends()
    {
        var range = DateRange.Create(Epoch, Epoch.AddDays(1)).Value;
        range.Contains(Epoch).Should().BeTrue();
        range.Contains(Epoch.AddDays(1)).Should().BeTrue();
        range.Contains(Epoch.AddDays(-1)).Should().BeFalse();
        range.Contains(Epoch.AddDays(2)).Should().BeFalse();
    }

    [Fact]
    public void Overlaps_Should_Report_True_At_The_Seam()
    {
        var a = DateRange.Create(Epoch, Epoch.AddDays(1)).Value;
        var b = DateRange.Create(Epoch.AddDays(1), Epoch.AddDays(2)).Value;
        a.Overlaps(b).Should().BeTrue();
    }

    [Fact]
    public void Overlaps_Should_Report_False_For_Disjoint_Ranges()
    {
        var a = DateRange.Create(Epoch, Epoch.AddDays(1)).Value;
        var b = DateRange.Create(Epoch.AddDays(2), Epoch.AddDays(3)).Value;
        a.Overlaps(b).Should().BeFalse();
    }

    [Fact]
    public void Clamp_Should_Intersect_With_Bounds()
    {
        var range = DateRange.Create(Epoch, Epoch.AddDays(10)).Value;
        var clipped = range.Clamp(Epoch.AddDays(2), Epoch.AddDays(5));

        clipped.Start.Should().Be(Epoch.AddDays(2));
        clipped.End.Should().Be(Epoch.AddDays(5));
    }
}
