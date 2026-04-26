namespace Enterprise.Platform.DbMigrator;

/// <summary>
/// Thrown when a previously-applied script's content on disk no longer matches
/// the SHA-256 stored in <c>__SchemaHistory</c>. This means someone edited a
/// script that has already run in some environment — a forbidden operation
/// because the hash check is the migrator's only line of defence against
/// silent schema drift.
/// </summary>
/// <remarks>
/// Recovery: revert the edit; if the new content is genuinely needed, add a
/// *new* script with the next sequence number.
/// </remarks>
public sealed class SchemaIntegrityException : Exception
{
    /// <summary>Initialises a new <see cref="SchemaIntegrityException"/>.</summary>
    public SchemaIntegrityException(string message) : base(message) { }
}
