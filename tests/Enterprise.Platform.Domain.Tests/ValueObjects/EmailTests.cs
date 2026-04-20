using Enterprise.Platform.Domain.ValueObjects;
using FluentAssertions;

namespace Enterprise.Platform.Domain.Tests.ValueObjects;

/// <summary>
/// Boundary + happy-path coverage for <see cref="Email"/>. Focuses on the invariants
/// callers actually depend on: normalisation, case-insensitive equality, and
/// defensive failure on malformed input.
/// </summary>
public sealed class EmailTests
{
    [Theory]
    [InlineData("user@example.com")]
    [InlineData("first.last+tag@sub.example.co.uk")]
    [InlineData(" USER@EXAMPLE.COM ")]
    public void Create_Should_Succeed_On_Valid_Input(string raw)
    {
        var result = Email.Create(raw);
        result.IsSuccess.Should().BeTrue();
        result.Value.Value.Should().Be(raw.Trim().ToLowerInvariant());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("no-at-sign")]
    [InlineData("missing@dot")]
    [InlineData("two@@at.signs")]
    [InlineData("spaces inside@example.com")]
    public void Create_Should_Fail_On_Invalid_Input(string? raw)
    {
        var result = Email.Create(raw);
        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be(Shared.Results.ErrorCodes.Validation);
    }

    [Fact]
    public void Equality_Should_Be_Case_Insensitive()
    {
        var a = Email.Create("Alice@Example.COM").Value;
        var b = Email.Create("alice@example.com").Value;

        a.Should().Be(b);
        a.GetHashCode().Should().Be(b.GetHashCode());
        (a == b).Should().BeTrue();
    }

    [Fact]
    public void ToString_Should_Return_Normalised_Value()
    {
        var email = Email.Create(" Bob@Example.com ").Value;
        email.ToString().Should().Be("bob@example.com");
    }
}
