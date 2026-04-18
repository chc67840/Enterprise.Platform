using Enterprise.Platform.Shared.Results;

namespace Enterprise.Platform.Domain.Exceptions;

/// <summary>
/// Thrown when a handler resolves an entity by id and it does not exist (or is not
/// visible under current tenant / soft-delete filters). Maps to HTTP 404.
/// </summary>
public sealed class EntityNotFoundException : DomainException
{
    /// <summary>Initializes a not-found exception with an explicit message.</summary>
    public EntityNotFoundException(string message)
        : base(ErrorCodes.NotFound, message)
    {
    }

    /// <summary>Convenience constructor — builds the message from entity type + key.</summary>
    public EntityNotFoundException(string entityName, object key)
        : base(ErrorCodes.NotFound, $"{entityName} with key '{key}' was not found.")
    {
    }
}
