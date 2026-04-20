using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;

namespace Enterprise.Platform.Shared.Guards;

/// <summary>
/// Marker interface for the fluent guard surface. Never implemented by callers — use
/// <see cref="Guard.Against"/>. Exists so that other tiers (Domain, Application) can
/// add domain-specific guards as extension methods on <see cref="IGuardClause"/> without
/// modifying <see cref="Guard"/> itself.
/// </summary>
public interface IGuardClause
{
}

/// <summary>
/// Fluent entry point for defensive argument validation. Use
/// <c>Guard.Against.Null(value)</c> at the top of public/protected members to enforce
/// invariants. Guards throw <see cref="ArgumentException"/>-family exceptions with the
/// argument name auto-captured via <see cref="CallerArgumentExpressionAttribute"/> —
/// never swallow results, never return sentinels.
/// </summary>
public static class Guard
{
    /// <summary>Singleton receiver for the fluent guard extension methods.</summary>
    public static IGuardClause Against { get; } = new GuardClauseImpl();

    private sealed class GuardClauseImpl : IGuardClause
    {
    }
}

/// <summary>
/// Built-in guard extension methods. Additional guards (e.g. <c>ValidEmail</c>,
/// <c>ValidPhoneNumber</c>) should be defined as extension methods on
/// <see cref="IGuardClause"/> in the tier that owns the rule.
/// </summary>
public static class GuardClauseExtensions
{
    /// <summary>Throws <see cref="ArgumentNullException"/> when <paramref name="value"/> is <c>null</c>.</summary>
    public static T Null<T>(
        this IGuardClause guardClause,
        T? value,
        [CallerArgumentExpression(nameof(value))] string? parameterName = null)
    {
        _ = guardClause;

        if (value is null)
        {
            throw new ArgumentNullException(parameterName);
        }

        return value;
    }

    /// <summary>Throws when <paramref name="value"/> is null or empty.</summary>
    public static string NullOrEmpty(
        this IGuardClause guardClause,
        string? value,
        [CallerArgumentExpression(nameof(value))] string? parameterName = null)
    {
        _ = guardClause;

        if (string.IsNullOrEmpty(value))
        {
            throw new ArgumentException("Value cannot be null or empty.", parameterName);
        }

        return value;
    }

    /// <summary>Throws when the collection is null or contains zero elements.</summary>
    public static IReadOnlyCollection<T> NullOrEmpty<T>(
        this IGuardClause guardClause,
        IReadOnlyCollection<T>? value,
        [CallerArgumentExpression(nameof(value))] string? parameterName = null)
    {
        _ = guardClause;

        if (value is null || value.Count == 0)
        {
            throw new ArgumentException("Collection cannot be null or empty.", parameterName);
        }

        return value;
    }

    /// <summary>Throws when <paramref name="value"/> is null, empty, or only whitespace.</summary>
    public static string NullOrWhiteSpace(
        this IGuardClause guardClause,
        string? value,
        [CallerArgumentExpression(nameof(value))] string? parameterName = null)
    {
        _ = guardClause;

        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Value cannot be null, empty, or whitespace.", parameterName);
        }

        return value;
    }

    /// <summary>Throws when <paramref name="value"/> falls outside the inclusive range <c>[min,max]</c>.</summary>
    public static T OutOfRange<T>(
        this IGuardClause guardClause,
        T value,
        T min,
        T max,
        [CallerArgumentExpression(nameof(value))] string? parameterName = null)
        where T : IComparable<T>
    {
        _ = guardClause;

        if (value.CompareTo(min) < 0 || value.CompareTo(max) > 0)
        {
            throw new ArgumentOutOfRangeException(
                parameterName,
                value,
                $"Value must be between {min} and {max} (inclusive).");
        }

        return value;
    }

    /// <summary>Throws when <paramref name="value"/> is zero or negative.</summary>
    public static T NegativeOrZero<T>(
        this IGuardClause guardClause,
        T value,
        [CallerArgumentExpression(nameof(value))] string? parameterName = null)
        where T : struct, IComparable<T>
    {
        _ = guardClause;

        if (value.CompareTo(default) <= 0)
        {
            throw new ArgumentOutOfRangeException(
                parameterName,
                value,
                "Value must be greater than zero.");
        }

        return value;
    }

    /// <summary>Throws when <paramref name="value"/>'s length is below <paramref name="minLength"/>.</summary>
    public static string MinLength(
        this IGuardClause guardClause,
        string? value,
        int minLength,
        [CallerArgumentExpression(nameof(value))] string? parameterName = null)
    {
        _ = guardClause;
        ArgumentOutOfRangeException.ThrowIfNegative(minLength);

        if (value is null || value.Length < minLength)
        {
            throw new ArgumentException(
                $"Value must be at least {minLength} character(s) long.",
                parameterName);
        }

        return value;
    }

    /// <summary>Throws when <paramref name="value"/>'s length is above <paramref name="maxLength"/>.</summary>
    public static string MaxLength(
        this IGuardClause guardClause,
        string? value,
        int maxLength,
        [CallerArgumentExpression(nameof(value))] string? parameterName = null)
    {
        _ = guardClause;
        ArgumentOutOfRangeException.ThrowIfNegative(maxLength);

        if (value is not null && value.Length > maxLength)
        {
            throw new ArgumentException(
                $"Value must be at most {maxLength} character(s) long.",
                parameterName);
        }

        return value ?? string.Empty;
    }

    /// <summary>Throws when <paramref name="value"/> does not match the supplied <paramref name="pattern"/>.</summary>
    /// <param name="guardClause">Fluent receiver.</param>
    /// <param name="value">Candidate string.</param>
    /// <param name="pattern">Regex pattern. Compiled per-call — keep patterns in static fields for hot paths.</param>
    /// <param name="parameterName">Captured automatically.</param>
    public static string InvalidFormat(
        this IGuardClause guardClause,
        string? value,
        string pattern,
        [CallerArgumentExpression(nameof(value))] string? parameterName = null)
    {
        guardClause.NullOrWhiteSpace(value, parameterName);
        guardClause.NullOrWhiteSpace(pattern, nameof(pattern));

        if (!Regex.IsMatch(value!, pattern, RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1)))
        {
            throw new ArgumentException(
                $"Value does not match the required format: {pattern}.",
                parameterName);
        }

        return value!;
    }
}
