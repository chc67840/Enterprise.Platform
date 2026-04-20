using System.Globalization;
using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Domain.Entities;
using Enterprise.Platform.Infrastructure;
using FluentAssertions;
using NetArchTest.Rules;

namespace Enterprise.Platform.Architecture.Tests;

/// <summary>
/// Structural invariants that pin the Clean Architecture dependency direction. These
/// tests fail the build if any new type in Domain/Application reaches upward into
/// Infrastructure/Api — the lowest-ceremony way to keep the boundary enforced as
/// new features land.
/// </summary>
public sealed class CleanArchitectureTests
{
    // Assemblies are referenced by exemplar type so renames at compile-time stay caught.
    private static readonly System.Reflection.Assembly DomainAssembly = typeof(BaseEntity).Assembly;
    private static readonly System.Reflection.Assembly ApplicationAssembly = typeof(IPipelineBehavior<,>).Assembly;
    private static readonly System.Reflection.Assembly InfrastructureAssembly = typeof(DependencyInjection).Assembly;

    private const string DomainNamespace = "Enterprise.Platform.Domain";
    private const string ApplicationNamespace = "Enterprise.Platform.Application";
    private const string InfrastructureNamespace = "Enterprise.Platform.Infrastructure";
    private const string ApiNamespace = "Enterprise.Platform.Api";

    [Fact]
    public void Domain_Should_Not_Depend_On_Application_Infrastructure_Or_Api()
    {
        var result = Types.InAssembly(DomainAssembly)
            .ShouldNot()
            .HaveDependencyOnAny(ApplicationNamespace, InfrastructureNamespace, ApiNamespace)
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FormatFailingTypes(
            "Domain must not reference Application / Infrastructure / Api.",
            result));
    }

    [Fact]
    public void Domain_Should_Not_Depend_On_EntityFrameworkCore()
    {
        var result = Types.InAssembly(DomainAssembly)
            .ShouldNot()
            .HaveDependencyOn("Microsoft.EntityFrameworkCore")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FormatFailingTypes(
            "Domain must not leak EF Core — persistence concerns live in Infrastructure.",
            result));
    }

    [Fact]
    public void Application_Should_Not_Depend_On_Infrastructure_Or_Api()
    {
        var result = Types.InAssembly(ApplicationAssembly)
            .ShouldNot()
            .HaveDependencyOnAny(InfrastructureNamespace, ApiNamespace)
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FormatFailingTypes(
            "Application must not reference Infrastructure / Api.",
            result));
    }

    [Fact]
    public void Application_Should_Not_Depend_On_EntityFrameworkCore()
    {
        // `Application.Abstractions.Persistence.IDbContextFactory` legitimately returns
        // EF Core's `DbContext` per design decision D3 (one DbContext per logical DB,
        // resolved through the factory at query time). Every other type in Application
        // must stay EF-free; it goes through IGenericRepository / IUnitOfWork / the
        // per-aggregate repos.
        const string AllowedEfNamespace = $"{ApplicationNamespace}.Abstractions.Persistence";

        var result = Types.InAssembly(ApplicationAssembly)
            .That()
            .DoNotResideInNamespace(AllowedEfNamespace)
            .ShouldNot()
            .HaveDependencyOn("Microsoft.EntityFrameworkCore")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FormatFailingTypes(
            "Application must not bind to EF Core — only the D3-sanctioned "
            + $"{AllowedEfNamespace} namespace may touch EF types.",
            result));
    }

    [Fact]
    public void Application_PipelineBehaviors_Should_Live_Under_Behaviors_Namespace()
    {
        var result = Types.InAssembly(ApplicationAssembly)
            .That()
            .ImplementInterface(typeof(IPipelineBehavior<,>))
            .And()
            .AreNotAbstract()
            .And()
            .AreNotInterfaces()
            .Should()
            .ResideInNamespaceStartingWith($"{ApplicationNamespace}.Behaviors")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FormatFailingTypes(
            "Every concrete IPipelineBehavior<,> must live under Application.Behaviors.*.",
            result));
    }

    [Fact]
    public void Infrastructure_Interceptors_Should_Be_Sealed()
    {
        // Save-changes interceptors are shared across pooled DbContext slots. Sealed
        // guards against accidental inheritance that reintroduces ctor-captured state.
        var result = Types.InAssembly(InfrastructureAssembly)
            .That()
            .ResideInNamespaceStartingWith($"{InfrastructureNamespace}.Persistence.Interceptors")
            .And()
            .AreClasses()
            .And()
            .AreNotAbstract()
            .Should()
            .BeSealed()
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FormatFailingTypes(
            "Interceptors must be sealed to preserve pool-safety guarantees.",
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
