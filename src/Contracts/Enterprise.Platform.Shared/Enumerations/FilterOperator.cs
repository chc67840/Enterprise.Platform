namespace Enterprise.Platform.Shared.Enumerations;

/// <summary>
/// Operator vocabulary used by generic list queries (see <c>FilterDescriptor</c> in
/// Application). Each value maps onto an EF Core predicate — the translator in the
/// <c>QueryableExtensions.ApplyFilters</c> helper is the single authority on how an
/// operator becomes SQL.
/// </summary>
public enum FilterOperator
{
    /// <summary>Equal (<c>=</c>).</summary>
    Eq = 0,

    /// <summary>Not equal (<c>&lt;&gt;</c>).</summary>
    Neq = 1,

    /// <summary>Greater than (<c>&gt;</c>).</summary>
    Gt = 2,

    /// <summary>Greater than or equal (<c>&gt;=</c>).</summary>
    Gte = 3,

    /// <summary>Less than (<c>&lt;</c>).</summary>
    Lt = 4,

    /// <summary>Less than or equal (<c>&lt;=</c>).</summary>
    Lte = 5,

    /// <summary>Case-insensitive substring match (<c>LIKE '%value%'</c>).</summary>
    Like = 6,

    /// <summary>Membership in a supplied list (<c>IN (...)</c>).</summary>
    In = 7,

    /// <summary>Inclusive range match (<c>BETWEEN lo AND hi</c>). Payload must be a two-element array.</summary>
    Between = 8,
}
