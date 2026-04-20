using Enterprise.Platform.Domain.ValueObjects;
using FluentAssertions;

namespace Enterprise.Platform.Domain.Tests.ValueObjects;

/// <summary>
/// <see cref="Money"/> is the arithmetic backbone for every pricing flow; these tests
/// pin: (1) construction validation, (2) cross-currency safety, and (3) the residual
/// distribution in <see cref="Money.Allocate"/> — the subtle one that a naive
/// divide-and-round implementation would lose cents on.
/// </summary>
public sealed class MoneyTests
{
    [Theory]
    [InlineData("USD")]
    [InlineData("usd")]
    [InlineData(" EUR ")]
    public void Create_Should_Normalise_Currency_Code(string input)
    {
        var result = Money.Create(100m, input.Trim());
        result.IsSuccess.Should().BeTrue();
        result.Value.Currency.Should().Be(input.Trim().ToUpperInvariant());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("US")]
    [InlineData("DOLLARS")]
    public void Create_Should_Fail_On_Bad_Currency(string? code)
    {
        var result = Money.Create(10m, code);
        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public void Add_Should_Succeed_For_Same_Currency()
    {
        var left = Money.Create(10m, "USD").Value;
        var right = Money.Create(25.50m, "USD").Value;

        var sum = left.Add(right);
        sum.Amount.Should().Be(35.50m);
        sum.Currency.Should().Be("USD");
    }

    [Fact]
    public void Add_Should_Throw_When_Currencies_Differ()
    {
        var usd = Money.Create(10m, "USD").Value;
        var eur = Money.Create(10m, "EUR").Value;

        var act = () => usd.Add(eur);
        act.Should().Throw<InvalidOperationException>()
           .WithMessage("*USD*EUR*");
    }

    [Fact]
    public void Divide_By_Zero_Should_Throw()
    {
        var money = Money.Create(100m, "USD").Value;
        var act = () => money.Divide(0m);
        act.Should().Throw<DivideByZeroException>();
    }

    [Fact]
    public void Allocate_Should_Distribute_Rounding_Residual_So_Parts_Sum_Exactly()
    {
        // $0.10 / 3 cannot be rounded evenly at 2 decimals — the residual cent must be
        // pushed into the first bucket so sum(parts) == original.
        var money = Money.Create(0.10m, "USD").Value;

        var parts = money.Allocate(3);

        parts.Should().HaveCount(3);
        parts.Sum(p => p.Amount).Should().Be(0.10m);
        parts[0].Amount.Should().Be(0.04m);
        parts[1].Amount.Should().Be(0.03m);
        parts[2].Amount.Should().Be(0.03m);
    }

    [Fact]
    public void Allocate_Should_Reject_NonPositive_Parts()
    {
        var money = Money.Create(100m, "USD").Value;
        var act = () => money.Allocate(0);
        act.Should().Throw<ArgumentOutOfRangeException>();
    }
}
