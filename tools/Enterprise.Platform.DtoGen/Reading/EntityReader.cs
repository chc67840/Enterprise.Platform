using Enterprise.Platform.DtoGen.Models;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Enterprise.Platform.DtoGen.Reading;

/// <summary>
/// Parses a single scaffolded entity .cs file into an <see cref="EntityDescriptor"/>
/// with the full property set already flattened (own props + inherited props from
/// the base-class chain). Skip rules from the config are applied here so the
/// emitters can stay dumb downstream.
/// </summary>
internal static class EntityReader
{
    public static async Task<EntityDescriptor?> ReadAsync(
        string filePath,
        IReadOnlyDictionary<string, BaseClassInfo> baseClassLookup,
        IReadOnlyCollection<string> skipColumns,
        CancellationToken cancellationToken)
    {
        var source = await File.ReadAllTextAsync(filePath, cancellationToken).ConfigureAwait(false);
        var tree = CSharpSyntaxTree.ParseText(source, cancellationToken: cancellationToken);
        var root = (CompilationUnitSyntax)await tree.GetRootAsync(cancellationToken).ConfigureAwait(false);

        // We expect exactly one entity per scaffolded file. If there's more than one
        // class declaration, take the first non-static one — this is the convention
        // EF Core's scaffolder follows.
        var classDecl = root.DescendantNodes()
            .OfType<ClassDeclarationSyntax>()
            .FirstOrDefault(c => !c.Modifiers.Any(m => m.IsKind(SyntaxKind.StaticKeyword)));
        if (classDecl is null)
        {
            return null;
        }

        var className = classDecl.Identifier.ValueText;
        var ns = root.DescendantNodes().OfType<BaseNamespaceDeclarationSyntax>().FirstOrDefault()?.Name.ToString()
                 ?? string.Empty;

        // Direct base — same shape we read for base classes themselves.
        var baseName = classDecl.BaseList?.Types.FirstOrDefault()?.Type
            is IdentifierNameSyntax ident ? ident.Identifier.ValueText : null;

        var skipSet = new HashSet<string>(skipColumns, StringComparer.OrdinalIgnoreCase);

        var ownProperties = classDecl.Members
            .OfType<PropertyDeclarationSyntax>()
            .Where(IsPublicReadable)
            .Where(p => !skipSet.Contains(p.Identifier.ValueText))
            .Select(p => new PropertyDescriptor(
                Name: p.Identifier.ValueText,
                TypeText: p.Type.ToString(),
                IsInherited: false))
            .ToList();

        // Walk base-class chain. De-duplicate by name (own props win when both sides
        // declare a property with the same name — which shouldn't happen post-template
        // but is defended against here).
        var inheritedProperties = WalkBases(baseName, baseClassLookup)
            .Where(p => !skipSet.Contains(p.Name))
            .Where(p => !ownProperties.Any(o => string.Equals(o.Name, p.Name, StringComparison.Ordinal)))
            .ToList();

        var allProperties = ownProperties.Concat(inheritedProperties).ToList();

        return new EntityDescriptor(className, ns, baseName, allProperties);
    }

    private static IEnumerable<PropertyDescriptor> WalkBases(
        string? startBase,
        IReadOnlyDictionary<string, BaseClassInfo> lookup)
    {
        var current = startBase;
        var visited = new HashSet<string>(StringComparer.Ordinal);
        while (current is not null && visited.Add(current))
        {
            if (!lookup.TryGetValue(current, out var info))
            {
                // Unknown base (e.g. `object`, `IEnumerable`, or an interface). Stop walking.
                yield break;
            }

            foreach (var p in info.OwnProperties)
            {
                yield return p;
            }

            current = info.BaseClassName;
        }
    }

    private static bool IsPublicReadable(PropertyDeclarationSyntax property)
    {
        var isPublic = property.Modifiers.Any(m => m.IsKind(SyntaxKind.PublicKeyword));
        if (!isPublic)
        {
            return false;
        }

        var hasSetter = property.AccessorList?.Accessors
            .Any(a => a.IsKind(SyntaxKind.SetAccessorDeclaration) || a.IsKind(SyntaxKind.InitAccessorDeclaration)) ?? false;
        return hasSetter;
    }
}
