using System.Diagnostics.CodeAnalysis;

namespace Enterprise.Platform.Application.Abstractions.Behaviors;

/// <summary>
/// Opt-in marker for high-risk commands that require a second principal to approve
/// before execution proceeds (maker-checker / four-eyes). No runtime behavior ships
/// in Phase 4 — the handler throws <c>BusinessRuleViolationException</c> until the
/// approval workflow lands. Kept as a marker so commands can declare their intent now.
/// </summary>
[SuppressMessage("Design", "CA1040:Avoid empty interfaces", Justification = "Marker interface — associated behavior lands in a later phase.")]
public interface IRequiresDualApproval
{
}
