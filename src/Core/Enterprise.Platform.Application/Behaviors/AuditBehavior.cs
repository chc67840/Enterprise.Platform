using System.Collections.Concurrent;
using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Common.Interfaces;
using Enterprise.Platform.Domain.Interfaces;
using Enterprise.Platform.Shared.Extensions;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Application.Behaviors;

/// <summary>
/// Pipeline order 4 — emits an <see cref="AuditEntry"/> for requests tagged with
/// <see cref="IRequiresAudit"/>. Runs on both success and failure paths so the audit
/// trail captures attempted operations. Writer errors never bubble — audit is
/// best-effort, the primary operation's outcome is authoritative.
/// </summary>
public sealed class AuditBehavior<TRequest, TResponse>(
    IAuditWriter auditWriter,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTime,
    ILogger<AuditBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private static readonly JsonSerializerOptions SnapshotOptions = new()
    {
        WriteIndented = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    // Per-type snapshot shape: list of (property name, accessor, mask-or-ignore).
    // Cached so reflection runs once per request type instead of once per command.
    private static readonly ConcurrentDictionary<Type, IReadOnlyList<SnapshotField>> ShapeCache = new();

    private enum SnapshotAction
    {
        Serialize = 0,
        Mask = 1,
        Ignore = 2,
    }

    private sealed record SnapshotField(string Name, Func<object, object?> Accessor, SnapshotAction Action, AuditMaskAttribute? MaskAttribute);

    /// <inheritdoc />
    public async Task<TResponse> HandleAsync(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(next);

        if (request is not IRequiresAudit audit)
        {
            return await next().ConfigureAwait(false);
        }

        var stopwatch = Stopwatch.StartNew();
        var timestamp = dateTime.UtcNow;
        Exception? failure = null;
        TResponse response = default!;

        try
        {
            response = await next().ConfigureAwait(false);
            return response;
        }
        catch (Exception ex)
        {
            failure = ex;
            throw;
        }
        finally
        {
            stopwatch.Stop();

            try
            {
                await auditWriter.WriteAsync(
                    new AuditEntry
                    {
                        Timestamp = timestamp,
                        UserId = currentUser.UserId,
                        Action = audit.AuditAction,
                        Subject = audit.AuditSubject,
                        RequestType = typeof(TRequest).Name,
                        RequestSnapshot = SerializeSnapshot(request),
                        Succeeded = failure is null,
                        FailureReason = failure?.Message,
                        ElapsedMilliseconds = stopwatch.ElapsedMilliseconds,
                    },
                    cancellationToken).ConfigureAwait(false);
            }
            catch (Exception writerEx) when (writerEx is not OperationCanceledException)
            {
                logger.AuditWriteFailed(writerEx, typeof(TRequest).Name);
            }
        }
    }

    /// <summary>
    /// Builds an audit-safe snapshot: properties marked <c>[AuditIgnore]</c> are dropped;
    /// <c>[AuditMask]</c> string values are masked via
    /// <see cref="StringExtensions.ToMask"/>; remaining properties serialize as-is.
    /// </summary>
    /// <remarks>
    /// <b>P3-6 audit:</b> the snapshot now recurses into nested complex objects so a
    /// command containing <c>command.Address.Street</c> applies <c>[AuditMask]</c>
    /// throughout the graph instead of only at the top level. Recursion is bounded
    /// by <see cref="MaxRecursionDepth"/> to prevent runaway when an aggregate has
    /// circular navigation properties — the offending branch is replaced with a
    /// type-hint placeholder.
    /// </remarks>
    private static string? SerializeSnapshot(TRequest request)
    {
        try
        {
            var safeShape = BuildSafeShape(request, depth: 0);
            return JsonSerializer.Serialize(safeShape, SnapshotOptions);
        }
        catch (NotSupportedException)
        {
            return null;
        }
    }

    /// <summary>Maximum object-graph depth to descend before replacing with a type hint.</summary>
    private const int MaxRecursionDepth = 8;

    private static object? BuildSafeShape(object? value, int depth)
    {
        if (value is null) return null;
        if (depth >= MaxRecursionDepth) return $"[depth-cap:{value.GetType().Name}]";

        var valueType = value.GetType();

        // Primitives + strings + value types serialize as-is — no graph to mask.
        if (valueType.IsPrimitive || value is string || valueType.IsEnum
            || value is decimal or DateTime or DateTimeOffset or TimeSpan or Guid or DateOnly or TimeOnly or Uri)
        {
            return value;
        }

        // Collections: recurse element-wise.
        if (value is System.Collections.IEnumerable enumerable)
        {
            var safeList = new List<object?>();
            foreach (var item in enumerable)
            {
                safeList.Add(BuildSafeShape(item, depth + 1));
            }
            return safeList;
        }

        // Complex object: walk fields per the cached shape, mask + recurse.
        var shape = ShapeCache.GetOrAdd(valueType, BuildShape);
        var safeDict = new Dictionary<string, object?>(shape.Count, StringComparer.Ordinal);

        foreach (var field in shape)
        {
            if (field.Action == SnapshotAction.Ignore)
            {
                continue;
            }

            var fieldValue = field.Accessor(value);

            safeDict[field.Name] = field.Action switch
            {
                SnapshotAction.Mask => MaskValue(fieldValue, field.MaskAttribute!),
                _ => BuildSafeShape(fieldValue, depth + 1),
            };
        }

        return safeDict;
    }

    private static string? MaskValue(object? value, AuditMaskAttribute mask) => value switch
    {
        null => null,
        string s => s.ToMask(mask.VisiblePrefix, mask.VisibleSuffix),
        _ => $"[{value.GetType().Name}]",   // non-string masks become a type-hint placeholder
    };

    private static IReadOnlyList<SnapshotField> BuildShape(Type type)
    {
        var properties = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
        var fields = new List<SnapshotField>(properties.Length);

        foreach (var property in properties)
        {
            if (!property.CanRead || property.GetIndexParameters().Length > 0)
            {
                continue;
            }

            var action = SnapshotAction.Serialize;
            AuditMaskAttribute? maskAttribute = null;

            if (property.GetCustomAttribute<AuditIgnoreAttribute>(inherit: true) is not null)
            {
                action = SnapshotAction.Ignore;
            }
            else if (property.GetCustomAttribute<AuditMaskAttribute>(inherit: true) is { } mask)
            {
                action = SnapshotAction.Mask;
                maskAttribute = mask;
            }

            var propertyRef = property;
            fields.Add(new SnapshotField(
                Name: JsonNamingPolicy.CamelCase.ConvertName(property.Name),
                Accessor: instance => propertyRef.GetValue(instance),
                Action: action,
                MaskAttribute: maskAttribute));
        }

        return fields;
    }
}
