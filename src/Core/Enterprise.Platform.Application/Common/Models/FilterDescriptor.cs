using Enterprise.Platform.Shared.Enumerations;

namespace Enterprise.Platform.Application.Common.Models;

/// <summary>
/// Single filter clause. Descriptors combine with AND semantics — OR groups require a
/// nested <c>FilterGroup</c> (future work). <see cref="Value"/> is operator-dependent:
/// <see cref="FilterOperator.In"/> takes an array; <see cref="FilterOperator.Between"/>
/// takes a two-element array; the rest take a scalar.
/// </summary>
public sealed class FilterDescriptor
{
    /// <summary>Property path the filter targets.</summary>
    public required string Field { get; init; }

    /// <summary>Comparison operator. See <see cref="FilterOperator"/>.</summary>
    public required FilterOperator Operator { get; init; }

    /// <summary>Operand. Type must match the target property (serializer-bound).</summary>
    public object? Value { get; init; }
}
