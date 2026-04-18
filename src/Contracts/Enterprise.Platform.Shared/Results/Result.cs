using System.Diagnostics.CodeAnalysis;

namespace Enterprise.Platform.Shared.Results;

/// <summary>
/// Railway-oriented result for operations that may succeed or fail without carrying a
/// payload. Never throws for expected failures — callers branch on
/// <see cref="IsSuccess"/> / <see cref="IsFailure"/> and inspect <see cref="Error"/>.
/// </summary>
public class Result
{
    /// <summary>Constructs a result. Internal — use <see cref="Success()"/> or <see cref="Failure(Error)"/>.</summary>
    protected internal Result(bool isSuccess, Error error)
    {
        switch (isSuccess)
        {
            case true when error != Results.Error.None:
                throw new InvalidOperationException("A successful Result cannot carry an error.");
            case false when error == Results.Error.None:
                throw new InvalidOperationException("A failed Result must carry an Error.");
            default:
                IsSuccess = isSuccess;
                Error = error;
                break;
        }
    }

    /// <summary><c>true</c> when the operation completed successfully.</summary>
    public bool IsSuccess { get; }

    /// <summary><c>true</c> when the operation failed. Convenience inverse of <see cref="IsSuccess"/>.</summary>
    public bool IsFailure => !IsSuccess;

    /// <summary>
    /// Error describing the failure. When <see cref="IsSuccess"/> is <c>true</c> this
    /// returns <see cref="Results.Error.None"/>.
    /// </summary>
    public Error Error { get; }

    /// <summary>Builds a non-generic success result.</summary>
    public static Result Success() => new(true, Results.Error.None);

    /// <summary>Builds a non-generic failure result carrying <paramref name="error"/>.</summary>
    public static Result Failure(Error error) => new(false, error);

    /// <summary>Builds a generic success result wrapping <paramref name="value"/>.</summary>
    public static Result<T> Success<T>(T value) => new(value, true, Results.Error.None);

    /// <summary>Builds a generic failure result carrying <paramref name="error"/> and no value.</summary>
    public static Result<T> Failure<T>(Error error) => new(default, false, error);
}

/// <summary>
/// Railway-oriented result carrying a typed <typeparamref name="T"/> payload on success.
/// </summary>
/// <typeparam name="T">Payload type returned on success.</typeparam>
public sealed class Result<T> : Result
{
    private readonly T? _value;

    internal Result(T? value, bool isSuccess, Error error) : base(isSuccess, error)
    {
        _value = value;
    }

    /// <summary>
    /// Success payload. Throws <see cref="InvalidOperationException"/> if accessed on a
    /// failed result — callers must branch on <see cref="Result.IsSuccess"/> first.
    /// </summary>
    [NotNull]
    public T Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException("Cannot access Value on a failed Result.");

    /// <summary>Implicit lift: <c>T</c> → <c>Result&lt;T&gt;.Success</c>.</summary>
    public static implicit operator Result<T>(T value) => Success(value);

    /// <summary>Implicit lift: <c>Error</c> → <c>Result&lt;T&gt;.Failure</c>.</summary>
    public static implicit operator Result<T>(Error error) => Failure<T>(error);
}
