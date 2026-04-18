namespace Enterprise.Platform.Application.Abstractions.Behaviors;

/// <summary>
/// Opt-in marker for idempotent commands. <c>IdempotencyBehavior</c> consults
/// <see cref="Common.Interfaces.IIdempotencyStore"/> for the supplied
/// <see cref="IdempotencyKey"/>: if a response is cached, it's returned without
/// re-running the handler; otherwise the handler runs and its response is stored for
/// <see cref="IdempotencyWindow"/>.
/// </summary>
public interface IIdempotent
{
    /// <summary>
    /// Client-supplied key (typically the <c>X-Idempotency-Key</c> header). Combined
    /// with the principal id and command type to form the store key.
    /// </summary>
    string IdempotencyKey { get; }

    /// <summary>
    /// How long the response stays in the store. Default 24h is a safe upper bound for
    /// most retry windows; override when shorter (payment flows) or longer is required.
    /// </summary>
    TimeSpan IdempotencyWindow => TimeSpan.FromHours(24);
}
