using Enterprise.Platform.Domain.ValueObjects;
using FluentAssertions;

namespace Enterprise.Platform.Domain.Tests.ValueObjects;

/// <summary>
/// Guards the ISO-4217 currency catalogue. The non-obvious assertions: JPY has
/// zero decimal digits (bugs in naive code assume 2 everywhere), and the lookup
/// is case-insensitive to tolerate mixed-case input from external systems.
/// </summary>
public sealed class CurrencyTests
{
    [Theory]
    [InlineData("USD")]
    [InlineData("usd")]
    [InlineData("EuR")]
    public void FromCode_Should_Resolve_Known_Codes_Case_Insensitively(string code)
    {
        var result = Currency.FromCode(code);
        result.IsSuccess.Should().BeTrue();
        result.Value.Code.Should().Be(code.ToUpperInvariant());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("US")]
    [InlineData("USDX")]
    [InlineData("ZZZ")]
    public void FromCode_Should_Fail_For_Unknown_Or_Malformed_Codes(string? code)
    {
        var result = Currency.FromCode(code);
        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public void Jpy_Should_Have_Zero_Decimal_Digits()
    {
        Currency.Jpy.DecimalDigits.Should().Be(0);
    }

    [Fact]
    public void Static_Singletons_Should_Be_Reference_Equal_Across_Lookups()
    {
        var first = Currency.FromCode("USD").Value;
        var second = Currency.FromCode("USD").Value;
        first.Should().BeSameAs(second);
        first.Should().BeSameAs(Currency.Usd);
    }

    [Fact]
    public void All_Should_Enumerate_The_Full_Catalogue()
    {
        Currency.All.Should().NotBeEmpty();
        Currency.All.Should().Contain(c => c.Code == "USD");
    }
}
