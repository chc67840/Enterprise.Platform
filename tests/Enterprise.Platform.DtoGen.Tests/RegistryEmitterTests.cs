using Enterprise.Platform.DtoGen.Models;
using Enterprise.Platform.DtoGen.Writing;
using FluentAssertions;
using Microsoft.CodeAnalysis.CSharp;

namespace Enterprise.Platform.DtoGen.Tests;

/// <summary>
/// Unit tests for <see cref="RegistryEmitter"/>. The registry is the single DI
/// entry point — a wrong class name or missing Register call here breaks
/// every consumer's ability to resolve <c>IMapper</c>.
/// </summary>
public sealed class RegistryEmitterTests
{
    [Fact]
    public void Emit_ProducesAddXxxMappersExtensionMethod()
    {
        var entities = new List<EntityDescriptor> { MakeEntity("User") };

        var output = RegistryEmitter.Emit(entities, "App", "Test.Entities", "Test.Dtos", "Test.Mappers");

        output.Should().Contain("public static class AppMappingRegistry");
        output.Should().Contain("public static IServiceCollection AddAppMappers(this IServiceCollection services)");
        AssertParsesCleanly(output);
    }

    [Fact]
    public void Emit_RegistersOneCallPerEntity()
    {
        // Three entities → three .Register calls. If the loop drops one, an
        // entity silently has no IMapper coverage and consumers get
        // MappingNotRegisteredException only at runtime.
        var entities = new List<EntityDescriptor>
        {
            MakeEntity("User"),
            MakeEntity("Order"),
            MakeEntity("Product"),
        };

        var output = RegistryEmitter.Emit(entities, "App", "Test.Entities", "Test.Dtos", "Test.Mappers");

        output.Should().Contain("registry.Register<User, UserDto>(UserMappers.ToDto);");
        output.Should().Contain("registry.Register<Order, OrderDto>(OrderMappers.ToDto);");
        output.Should().Contain("registry.Register<Product, ProductDto>(ProductMappers.ToDto);");
    }

    [Fact]
    public void Emit_UsesTryAddSingleton_ToAvoidMultiDbCollision()
    {
        // The whole point of TryAdd here is that a host wiring multiple DBs
        // (App + Platform) doesn't have the second AddXxxMappers overwrite the
        // first. Regression-protect the wording.
        var entities = new List<EntityDescriptor> { MakeEntity("User") };

        var output = RegistryEmitter.Emit(entities, "App", "Test.Entities", "Test.Dtos", "Test.Mappers");

        output.Should().Contain("services.TryAddSingleton<IMapper>");
    }

    private static EntityDescriptor MakeEntity(string name)
        => new(name, "Test.Entities", BaseClassName: null, Properties:
            [new PropertyDescriptor("Name", "string", IsInherited: false)]);

    private static void AssertParsesCleanly(string source)
    {
        var tree = CSharpSyntaxTree.ParseText(source);
        var diagnostics = tree.GetDiagnostics().ToList();
        diagnostics.Should().BeEmpty(because: "Roslyn should accept the emitter output without complaint");
    }
}
