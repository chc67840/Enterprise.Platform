namespace Enterprise.Platform.Contracts.Abstractions.Mapping;

/// <summary>
/// Type-pair object mapping façade. Hand-written interface; the generated
/// <c>GeneratedMapper</c> implementation (one per database) registers every
/// scaffolded entity ↔ DTO pair in its constructor and dispatches via dictionary
/// lookup at call time — no reflection on the hot path.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why a façade?</b> Most handlers can use the per-entity extension method
/// directly (<c>user.ToDto()</c>) — concise, statically typed, no DI ceremony.
/// The interface exists for the small fraction of cases that need polymorphic
/// dispatch: generic helpers, repository scaffolds that don't know their
/// concrete entity type at compile time, and tests that want to swap in a
/// fake mapper without touching the static extension surface.
/// </para>
/// <para>
/// <b>Failure mode.</b> An unregistered type-pair throws
/// <see cref="MappingNotRegisteredException"/> with both type names, not a
/// generic <c>KeyNotFoundException</c>. The error mentions the
/// <c>Add&lt;Db&gt;Mappers</c> call site so the fix is one click away in the
/// stack trace.
/// </para>
/// <para>
/// <b>Why not Mapster / AutoMapper.</b> Both are third-party (AutoMapper went
/// commercial in 2024); this codebase keeps Microsoft-only NuGet dependencies.
/// DtoGen emits the equivalent code statically, which also gives us
/// faster cold-start (no convention scan) and zero per-call reflection.
/// </para>
/// </remarks>
public interface IMapper
{
    /// <summary>
    /// Maps <paramref name="source"/> from <typeparamref name="TSource"/> to
    /// <typeparamref name="TDestination"/>. Throws when the pair is not
    /// registered.
    /// </summary>
    TDestination Map<TSource, TDestination>(TSource source) where TSource : notnull;

    /// <summary>
    /// Non-generic overload for repository / scaffold scenarios where the
    /// source type is only known at runtime. The runtime type of
    /// <paramref name="source"/> is used as the source key, not its declared
    /// static type.
    /// </summary>
    object Map(object source, Type destinationType);
}
