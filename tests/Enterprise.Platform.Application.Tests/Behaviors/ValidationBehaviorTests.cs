using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Behaviors;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Moq;

namespace Enterprise.Platform.Application.Tests.Behaviors;

/// <summary>
/// Covers the two defensible paths of <see cref="ValidationBehavior{TRequest,TResponse}"/>:
/// every validator succeeds ⇒ <c>next()</c> runs and its response propagates;
/// any validator fails ⇒ <see cref="ValidationException"/> is thrown with the
/// aggregated failures (so the HTTP middleware can render a 400 with per-field errors).
/// </summary>
public sealed class ValidationBehaviorTests
{
    public sealed record TestRequest(string Payload);

    [Fact]
    public async Task HandleAsync_Should_Invoke_Next_When_No_Validators_Are_Registered()
    {
        var behavior = new ValidationBehavior<TestRequest, string>([]);
        var invoked = false;
        Task<string> Next()
        {
            invoked = true;
            return Task.FromResult("ok");
        }

        var response = await behavior.HandleAsync(
            new TestRequest("x"), Next, CancellationToken.None);

        invoked.Should().BeTrue();
        response.Should().Be("ok");
    }

    [Fact]
    public async Task HandleAsync_Should_Invoke_Next_When_All_Validators_Pass()
    {
        var validator = new Mock<IValidator<TestRequest>>();
        validator
            .Setup(v => v.ValidateAsync(It.IsAny<ValidationContext<TestRequest>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult());

        var behavior = new ValidationBehavior<TestRequest, string>([validator.Object]);
        var invoked = false;
        Task<string> Next()
        {
            invoked = true;
            return Task.FromResult("ok");
        }

        var response = await behavior.HandleAsync(
            new TestRequest("x"), Next, CancellationToken.None);

        invoked.Should().BeTrue();
        response.Should().Be("ok");
    }

    [Fact]
    public async Task HandleAsync_Should_Throw_ValidationException_And_Skip_Next_When_Any_Validator_Fails()
    {
        var failingValidator = new Mock<IValidator<TestRequest>>();
        failingValidator
            .Setup(v => v.ValidateAsync(It.IsAny<ValidationContext<TestRequest>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult([new ValidationFailure("Payload", "required")]));

        var passingValidator = new Mock<IValidator<TestRequest>>();
        passingValidator
            .Setup(v => v.ValidateAsync(It.IsAny<ValidationContext<TestRequest>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult());

        var behavior = new ValidationBehavior<TestRequest, string>(
            [failingValidator.Object, passingValidator.Object]);

        var invoked = false;
        Task<string> Next()
        {
            invoked = true;
            return Task.FromResult("ok");
        }

        var act = async () => await behavior.HandleAsync(
            new TestRequest("x"), Next, CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ValidationException>();
        exception.Which.Errors.Should().ContainSingle(f => f.PropertyName == "Payload");
        invoked.Should().BeFalse("next() must not run when validation fails");
    }
}
