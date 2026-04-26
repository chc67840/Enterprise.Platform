using Enterprise.Platform.DtoGen.Models;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Enterprise.Platform.DtoGen.Reading;

/// <summary>
/// Parses base-class .cs files (<c>BaseEntity</c>, <c>AuditableEntity</c>,
/// <c>AggregateRoot</c>) and produces a name → property-list lookup so the
/// entity reader can flatten inherited properties into the DTO.
/// </summary>
/// <remarks>
/// Source-only — no compilation, no assembly load. Each file is treated as
/// independent text; we never try to follow `: SomeBase` in a file we
/// haven't been told about. Configure all base-class files explicitly via
/// <c>baseClassFiles</c> in the JSON config.
/// </remarks>
internal static class BaseClassReader
{
    public static async Task<IReadOnlyDictionary<string, BaseClassInfo>> ReadAsync(
        IEnumerable<string> filePaths,
        IReadOnlyCollection<string> skipColumns,
        CancellationToken cancellationToken)
    {
        var lookup = new Dictionary<string, BaseClassInfo>(StringComparer.Ordinal);
        var skipSet = new HashSet<string>(skipColumns, StringComparer.OrdinalIgnoreCase);

        foreach (var path in filePaths)
        {
            if (!File.Exists(path))
            {
                throw new FileNotFoundException(
                    $"Base class file not found: {path}. Check the 'baseClassFiles' entries in the DtoGen config.");
            }

            var source = await File.ReadAllTextAsync(path, cancellationToken).ConfigureAwait(false);
            var tree = CSharpSyntaxTree.ParseText(source, cancellationToken: cancellationToken);
            var root = (CompilationUnitSyntax)await tree.GetRootAsync(cancellationToken).ConfigureAwait(false);

            // A base-class file may declare more than one type; emit one
            // BaseClassInfo per qualifying class.
            foreach (var classDecl in root.DescendantNodes().OfType<ClassDeclarationSyntax>())
            {
                var name = classDecl.Identifier.ValueText;
                var baseName = classDecl.BaseList?.Types.FirstOrDefault()?.Type
                    is IdentifierNameSyntax ident ? ident.Identifier.ValueText : null;

                var properties = classDecl.Members
                    .OfType<PropertyDeclarationSyntax>()
                    .Where(IsPublicReadable)
                    .Where(p => !skipSet.Contains(p.Identifier.ValueText))
                    .Select(p => new PropertyDescriptor(
                        Name: p.Identifier.ValueText,
                        TypeText: p.Type.ToString(),
                        IsInherited: true))
                    .ToList();

                lookup[name] = new BaseClassInfo(name, baseName, properties);
            }
        }

        return lookup;
    }

    private static bool IsPublicReadable(PropertyDeclarationSyntax property)
    {
        // Skip non-public; skip computed properties without a setter (DomainEvents etc. —
        // they're read-only views over internal state, not data).
        var isPublic = property.Modifiers.Any(m => m.IsKind(SyntaxKind.PublicKeyword));
        if (!isPublic)
        {
            return false;
        }

        // Expression-bodied properties (`=> _x`) and read-only auto-properties without
        // an explicit setter aren't part of the entity's data shape.
        var hasSetter = property.AccessorList?.Accessors
            .Any(a => a.IsKind(SyntaxKind.SetAccessorDeclaration) || a.IsKind(SyntaxKind.InitAccessorDeclaration)) ?? false;
        return hasSetter;
    }
}

/// <summary>One parsed base class.</summary>
internal sealed record BaseClassInfo(
    string Name,
    string? BaseClassName,
    IReadOnlyList<PropertyDescriptor> OwnProperties);
