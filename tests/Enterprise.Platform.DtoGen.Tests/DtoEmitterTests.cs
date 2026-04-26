using Enterprise.Platform.DtoGen.Models;
using Enterprise.Platform.DtoGen.Writing;
using FluentAssertions;
using Microsoft.CodeAnalysis.CSharp;

namespace Enterprise.Platform.DtoGen.Tests;

/// <summary>
/// Unit tests for <see cref="DtoEmitter"/>. Each emitted file is round-tripped
/// through Roslyn's parser to assert the output is syntactically valid C# —
/// catches the common emitter bugs (missing comma, wrong delimiter on the last
/// property, dangling parens) without us hand-asserting every character.
/// </summary>
public sealed class DtoEmitterTests
{
    [Fact]
    public void Emit_WithSingleProperty_ProducesValidRecord()
    {
        var entity = new EntityDescriptor(
            ClassName: "Sample",
            Namespace: "Test.Entities",
            BaseClassName: null,
            Properties: [new PropertyDescriptor("Name", "string", IsInherited: false)]);

        var output = DtoEmitter.Emit(entity, "Test.Dtos");

        output.Should().Contain("namespace Test.Dtos;");
        output.Should().Contain("public sealed record SampleDto(");
        output.Should().Contain("string Name);");
        AssertParsesCleanly(output);
    }

    [Fact]
    public void Emit_WithMultipleProperties_DelimitsCorrectly()
    {
        // Multi-property emission is the most common bug surface — getting the comma
        // vs `);` decision wrong on the last property is a one-character mistake that
        // breaks the build for every consumer.
        var entity = new EntityDescriptor(
            ClassName: "User",
            Namespace: "Test.Entities",
            BaseClassName: "AuditableEntity",
            Properties:
            [
                new PropertyDescriptor("Email", "string", IsInherited: false),
                new PropertyDescriptor("IsActive", "bool", IsInherited: false),
                new PropertyDescriptor("CreatedAt", "DateTimeOffset", IsInherited: true),
                new PropertyDescriptor("Id", "Guid", IsInherited: true),
            ]);

        var output = DtoEmitter.Emit(entity, "Test.Dtos");

        output.Should().Contain("string Email,");
        output.Should().Contain("bool IsActive,");
        output.Should().Contain("DateTimeOffset CreatedAt,");
        output.Should().Contain("Guid Id);");
        AssertParsesCleanly(output);
    }

    [Fact]
    public void Emit_PreservesNullableMarkers()
    {
        var entity = new EntityDescriptor(
            ClassName: "Sample",
            Namespace: "Test.Entities",
            BaseClassName: null,
            Properties:
            [
                new PropertyDescriptor("Note", "string?", IsInherited: false),
                new PropertyDescriptor("OptionalId", "Guid?", IsInherited: false),
            ]);

        var output = DtoEmitter.Emit(entity, "Test.Dtos");

        output.Should().Contain("string? Note,");
        output.Should().Contain("Guid? OptionalId);");
        AssertParsesCleanly(output);
    }

    [Fact]
    public void Emit_ThrowsOnNullEntity()
    {
        FluentActions.Invoking(() => DtoEmitter.Emit(null!, "Test.Dtos"))
            .Should().Throw<ArgumentNullException>();
    }

    [Fact]
    public void Emit_ThrowsOnEmptyNamespace()
    {
        var entity = new EntityDescriptor("X", "Test", null, []);
        FluentActions.Invoking(() => DtoEmitter.Emit(entity, "  "))
            .Should().Throw<ArgumentException>();
    }

    private static void AssertParsesCleanly(string source)
    {
        var tree = CSharpSyntaxTree.ParseText(source);
        var diagnostics = tree.GetDiagnostics().ToList();
        diagnostics.Should().BeEmpty(because: "Roslyn should accept the emitter output without complaint");
    }
}
