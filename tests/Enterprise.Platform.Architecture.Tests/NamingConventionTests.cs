using System.Globalization;
using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Abstractions.Messaging;
using FluentAssertions;
using FluentValidation;
using NetArchTest.Rules;

namespace Enterprise.Platform.Architecture.Tests;

/// <summary>
/// Enforces naming invariants across the Application layer. Names carry meaning in the
/// CQRS pipeline — the dispatcher discovers handlers by open-generic interface, but
/// humans scan for <c>*Handler</c> / <c>*Validator</c>. If a team member ships a
/// <c>UpdateRoleService</c> or <c>RoleRulesEngine</c> that happens to implement
/// <see cref="ICommandHandler{TCommand, TResult}"/>, the pipeline still works but the
/// codebase drifts — these tests fail the build first.
/// </summary>
public sealed class NamingConventionTests
{
    private static readonly System.Reflection.Assembly ApplicationAssembly = typeof(IPipelineBehavior<,>).Assembly;
    private static readonly System.Reflection.Assembly InfrastructureAssembly = typeof(Infrastructure.DependencyInjection).Assembly;

    [Fact]
    public void ICommandHandler_Implementations_Should_End_With_Handler()
    {
        var result = Types.InAssembly(ApplicationAssembly)
            .That()
            .ImplementInterface(typeof(ICommandHandler<>))
            .Or()
            .ImplementInterface(typeof(ICommandHandler<,>))
            .And()
            .AreNotAbstract()
            .And()
            .AreNotInterfaces()
            .Should()
            .HaveNameEndingWith("Handler", StringComparison.Ordinal)
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FormatFailingTypes(
            "Every concrete ICommandHandler implementation must end with 'Handler'.",
            result));
    }

    [Fact]
    public void IQueryHandler_Implementations_Should_End_With_Handler()
    {
        var result = Types.InAssembly(ApplicationAssembly)
            .That()
            .ImplementInterface(typeof(IQueryHandler<,>))
            .And()
            .AreNotAbstract()
            .And()
            .AreNotInterfaces()
            .Should()
            .HaveNameEndingWith("Handler", StringComparison.Ordinal)
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FormatFailingTypes(
            "Every concrete IQueryHandler implementation must end with 'Handler'.",
            result));
    }

    [Fact]
    public void FluentValidation_Validators_Should_End_With_Validator()
    {
        // AbstractValidator<T> is the conventional FluentValidation base. Inheriting
        // IValidator directly bypasses CA-friendly rulesets; disallow that here too.
        var result = Types.InAssembly(ApplicationAssembly)
            .That()
            .Inherit(typeof(AbstractValidator<>))
            .And()
            .AreNotAbstract()
            .And()
            .AreNotInterfaces()
            .Should()
            .HaveNameEndingWith("Validator", StringComparison.Ordinal)
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FormatFailingTypes(
            "Every concrete FluentValidation AbstractValidator<T> must end with 'Validator'.",
            result));
    }

    [Fact]
    public void Concrete_Pipeline_Behaviors_Should_End_With_Behavior()
    {
        var result = Types.InAssembly(ApplicationAssembly)
            .That()
            .ImplementInterface(typeof(IPipelineBehavior<,>))
            .And()
            .AreNotAbstract()
            .And()
            .AreNotInterfaces()
            .Should()
            .HaveNameEndingWith("Behavior", StringComparison.Ordinal)
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FormatFailingTypes(
            "Every concrete IPipelineBehavior<,> must end with 'Behavior' (reader convention).",
            result));
    }

    [Fact]
    public void Infrastructure_Repositories_Should_End_With_Repository()
    {
        // Per-aggregate repositories under Infrastructure.Persistence.<DB>.Repositories
        // must follow the Repository suffix. Caught cheaply; saves a PR review cycle.
        var result = Types.InAssembly(InfrastructureAssembly)
            .That()
            .ResideInNamespaceMatching(@"^Enterprise\.Platform\.Infrastructure\.Persistence\.\w+\.Repositories$")
            .And()
            .AreClasses()
            .And()
            .AreNotAbstract()
            .Should()
            .HaveNameEndingWith("Repository", StringComparison.Ordinal)
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FormatFailingTypes(
            "Concrete repositories under Infrastructure.Persistence.<DB>.Repositories must end with 'Repository'.",
            result));
    }

    [Fact]
    public void Infrastructure_Interceptors_Should_End_With_Interceptor()
    {
        var result = Types.InAssembly(InfrastructureAssembly)
            .That()
            .ResideInNamespaceStartingWith("Enterprise.Platform.Infrastructure.Persistence.Interceptors")
            .And()
            .AreClasses()
            .And()
            .AreNotAbstract()
            .Should()
            .HaveNameEndingWith("Interceptor", StringComparison.Ordinal)
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FormatFailingTypes(
            "Concrete types under Infrastructure.Persistence.Interceptors must end with 'Interceptor'.",
            result));
    }

    private static string FormatFailingTypes(string summary, TestResult result)
    {
        var failing = result.FailingTypeNames ?? [];
        return string.Create(
            CultureInfo.InvariantCulture,
            $"{summary}\nFailing types ({failing.Count}):\n  - {string.Join("\n  - ", failing)}");
    }
}
