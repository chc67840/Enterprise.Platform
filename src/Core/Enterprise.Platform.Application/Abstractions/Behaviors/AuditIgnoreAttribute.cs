namespace Enterprise.Platform.Application.Abstractions.Behaviors;

/// <summary>
/// Properties marked with this attribute are omitted from
/// <c>AuditBehavior.SerializeSnapshot</c> output. Use on secrets / high-sensitivity
/// PII that should never land in the audit store (passwords, full payment tokens,
/// government ids when not masked).
/// </summary>
[AttributeUsage(AttributeTargets.Property, AllowMultiple = false, Inherited = true)]
public sealed class AuditIgnoreAttribute : Attribute;

/// <summary>
/// Properties marked with this attribute are masked in the audit snapshot via
/// <c>Shared.Extensions.StringExtensions.ToMask</c>. Non-string properties are
/// serialised as their type name placeholder.
/// </summary>
[AttributeUsage(AttributeTargets.Property, AllowMultiple = false, Inherited = true)]
public sealed class AuditMaskAttribute : Attribute
{
    /// <summary>Characters to leave visible at the start (default 2).</summary>
    public int VisiblePrefix { get; init; } = 2;

    /// <summary>Characters to leave visible at the end (default 2).</summary>
    public int VisibleSuffix { get; init; } = 2;
}
