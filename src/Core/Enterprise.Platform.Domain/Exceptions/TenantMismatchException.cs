using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Domain.Exceptions;

/// <summary>
/// Thrown when a handler attempts to operate on an entity that does not belong to the
/// current request's tenant. In shared-database isolation mode this is the last line of
/// defence behind the global query filter.
/// </summary>
public sealed class TenantMismatchException : DomainException
{
    /// <summary>Initializes with an explicit message.</summary>
    public TenantMismatchException(string message)
        : base(ErrorCodes.Forbidden, message)
    {
    }

    /// <summary>Convenience constructor — describes which tenants disagreed.</summary>
    public TenantMismatchException(Guid expectedTenantId, Guid actualTenantId)
        : base(
            ErrorCodes.Forbidden,
            $"Tenant mismatch: expected '{expectedTenantId}', entity belongs to '{actualTenantId}'.")
    {
    }
}
