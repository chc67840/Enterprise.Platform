using System.Diagnostics.CodeAnalysis;

namespace Enterprise.Platform.Application.Abstractions.Behaviors;

/// <summary>
/// Opt-in marker. Commands tagged with this interface run inside an explicit
/// transaction opened by <c>TransactionBehavior</c>: the behavior calls
/// <c>BeginTransactionAsync</c>, invokes the handler, and commits on success / rolls
/// back on exception. Commands that only do a single <c>SaveChangesAsync</c> do NOT
/// need this — EF Core's implicit per-SaveChanges transaction is enough.
/// </summary>
[SuppressMessage("Design", "CA1040:Avoid empty interfaces", Justification = "Opt-in marker consumed by TransactionBehavior at runtime.")]
public interface ITransactional
{
}
