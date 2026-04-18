using System.Diagnostics;
using System.Text.Json;
using Enterprise.Platform.Application.Abstractions.Behaviors;
using Enterprise.Platform.Application.Common.Interfaces;
using Enterprise.Platform.Domain.Interfaces;
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
    ICurrentTenantService currentTenant,
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
                        TenantId = currentTenant.TenantId,
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

    private static string? SerializeSnapshot(TRequest request)
    {
        try
        {
            return JsonSerializer.Serialize(request, SnapshotOptions);
        }
        catch (NotSupportedException)
        {
            // Non-serializable graph — prefer "null snapshot" to throwing in the audit path.
            return null;
        }
    }
}
