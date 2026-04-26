using Enterprise.Platform.DtoGen.Models;
using Enterprise.Platform.DtoGen.Writing;
using FluentAssertions;
using Microsoft.CodeAnalysis.CSharp;

namespace Enterprise.Platform.DtoGen.Tests;

/// <summary>
/// Unit tests for <see cref="MapperEmitter"/>. The mapper file has more moving
/// parts than the DTO file (extension method, named-argument list, partial
/// hook), so each shape is asserted directly + the whole thing is parsed.
/// </summary>
public sealed class MapperEmitterTests
{
    [Fact]
    public void Emit_ContainsToDtoExtensionMethod()
    {
        var entity = MakeEntity("User", ["Email", "IsActive"]);

        var output = MapperEmitter.Emit(entity, "Test.Entities", "Test.Dtos", "Test.Mappers");

        output.Should().Contain("public static UserDto ToDto(this User source)");
        output.Should().Contain("Email: source.Email");
        output.Should().Contain("IsActive: source.IsActive");
        AssertParsesCleanly(output);
    }

    [Fact]
    public void Emit_IncludesCustomizationHook()
    {
        // The partial hook is what makes the generated mapper customisable
        // without touching the generated file. If the signature drifts, hand-
        // authored partials silently stop compiling — assert the exact shape.
        var entity = MakeEntity("Order", ["Total"]);

        var output = MapperEmitter.Emit(entity, "Test.Entities", "Test.Dtos", "Test.Mappers");

        output.Should().Contain("static partial void CustomizeToDto(Order source, ref OrderDto dto);");
        output.Should().Contain("CustomizeToDto(source, ref dto);");
    }

    [Fact]
    public void Emit_PartialClassMatchesEntityName()
    {
        // The class name must be `<Entity>Mappers` so hand-authored sibling
        // partials in the same namespace can extend it. A typo here breaks
        // every custom mapping.
        var entity = MakeEntity("Account", ["Id"]);

        var output = MapperEmitter.Emit(entity, "Test.Entities", "Test.Dtos", "Test.Mappers");

        output.Should().Contain("public static partial class AccountMappers");
    }

    [Fact]
    public void Emit_AlwaysIncludesNullCheckOnSource()
    {
        // ArgumentNullException.ThrowIfNull has been our convention since the
        // P0 audit; missing it here would create a divergence between hand-
        // authored and generated code.
        var entity = MakeEntity("Sample", ["Name"]);

        var output = MapperEmitter.Emit(entity, "Test.Entities", "Test.Dtos", "Test.Mappers");

        output.Should().Contain("ArgumentNullException.ThrowIfNull(source);");
    }

    private static EntityDescriptor MakeEntity(string name, string[] propertyNames)
    {
        var props = propertyNames
            .Select(p => new PropertyDescriptor(p, "string", IsInherited: false))
            .ToList();
        return new EntityDescriptor(name, "Test.Entities", BaseClassName: null, Properties: props);
    }

    private static void AssertParsesCleanly(string source)
    {
        var tree = CSharpSyntaxTree.ParseText(source);
        var diagnostics = tree.GetDiagnostics().ToList();
        diagnostics.Should().BeEmpty(because: "Roslyn should accept the emitter output without complaint");
    }
}
