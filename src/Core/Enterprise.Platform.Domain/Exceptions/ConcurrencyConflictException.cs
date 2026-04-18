using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Domain.Exceptions;

/// <summary>
/// Raised by the infrastructure translator when EF Core's
/// <see cref="T:Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException"/> fires —
/// i.e. a row's <c>RowVersion</c> changed between read and write. Maps to HTTP 409.
/// </summary>
public sealed class ConcurrencyConflictException : DomainException
{
    /// <summary>Initializes with an explicit message.</summary>
    public ConcurrencyConflictException(string message)
        : base(ErrorCodes.Conflict, message)
    {
    }

    /// <summary>Convenience constructor — describes the conflicting entity.</summary>
    public ConcurrencyConflictException(string entityName, object key)
        : base(
            ErrorCodes.Conflict,
            $"{entityName} with key '{key}' was modified by another process. Reload and try again.")
    {
    }
}
