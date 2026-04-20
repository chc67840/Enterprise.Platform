using Enterprise.Platform.Domain.ValueObjects;
using FluentAssertions;

namespace Enterprise.Platform.Domain.Tests.ValueObjects;

/// <summary>
/// Covers the clamping + fraction-derivation semantics of <see cref="Percentage"/>.
/// The tests are deliberately at the range boundary (0, 100) because that's where
/// arithmetic rounding or strict-inequality bugs like to hide.
/// </summary>
public sealed class PercentageTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(50)]
    [InlineData(100)]
    public void Create_Should_Accept_In_Range_Values(decimal value)
    {
        var result = Percentage.Create(value);
        result.IsSuccess.Should().BeTrue();
        result.Value.Value.Should().Be(value);
    }

    [Theory]
    [InlineData(-0.01)]
    [InlineData(100.01)]
    public void Create_Should_Reject_Out_Of_Range_Values(decimal value)
    {
        var result = Percentage.Create(value);
        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public void Fraction_Should_Be_Value_Over_One_Hundred()
    {
        var twentyFive = Percentage.Create(25m).Value;
        twentyFive.Fraction.Should().Be(0.25m);
    }

    [Fact]
    public void Add_Should_Clamp_At_Max()
    {
        var eighty = Percentage.Create(80m).Value;
        var thirty = Percentage.Create(30m).Value;
        eighty.Add(thirty).Value.Should().Be(Percentage.Max);
    }

    [Fact]
    public void Subtract_Should_Clamp_At_Min()
    {
        var ten = Percentage.Create(10m).Value;
        var twenty = Percentage.Create(20m).Value;
        ten.Subtract(twenty).Value.Should().Be(Percentage.Min);
    }

    [Fact]
    public void Of_Should_Apply_Percentage_To_Amount()
    {
        var fifteen = Percentage.Create(15m).Value;
        fifteen.Of(200m).Should().Be(30m);
    }
}
