using Enterprise.Platform.Infrastructure.Common;
using Enterprise.Platform.Infrastructure.Persistence.App.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Infrastructure.Persistence.Outbox;

/// <summary>
/// Hosted service that guarantees the <c>PlatformOutboxMessages</c> table exists in
/// AppDb before any outbox write attempts to use it. Runs once at startup via an
/// idempotent SQL check — avoids an EF migration dependency and keeps the
/// bootstrap hermetic on first deployment.
/// </summary>
/// <remarks>
/// Uses SQL Server syntax (<c>IF NOT EXISTS (SELECT ... FROM sys.tables)</c>). When
/// the platform adds Postgres in the future, the DDL will need a provider switch;
/// for now it matches the SqlServer provider already wired for AppDb.
/// </remarks>
public sealed class OutboxSchemaBootstrapper(
    IServiceProvider serviceProvider,
    ILogger<OutboxSchemaBootstrapper> logger) : IHostedService
{
    private const string EnsureTableSql = """
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PlatformOutboxMessages' AND SCHEMA_NAME(schema_id) = 'dbo')
        BEGIN
            CREATE TABLE [dbo].[PlatformOutboxMessages] (
                [Id]              UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_PlatformOutboxMessages] PRIMARY KEY,
                [EventType]       NVARCHAR(200) NOT NULL,
                [Payload]         NVARCHAR(MAX) NOT NULL,
                [CreatedAt]       DATETIME2(7) NOT NULL,
                [PublishedAt]     DATETIME2(7) NULL,
                [AttemptCount]    INT NOT NULL CONSTRAINT [DF_PlatformOutboxMessages_AttemptCount] DEFAULT 0,
                [LastError]       NVARCHAR(MAX) NULL,
                [NextAttemptAt]   DATETIME2(7) NULL,
                [CorrelationId]   NVARCHAR(64) NULL
            );

            CREATE INDEX [IX_PlatformOutboxMessages_PublishedAt_NextAttemptAt]
                ON [dbo].[PlatformOutboxMessages] ([PublishedAt], [NextAttemptAt])
                WHERE [PublishedAt] IS NULL;
        END
        """;

    private readonly IServiceProvider _serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));
    private readonly ILogger<OutboxSchemaBootstrapper> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <inheritdoc />
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var scope = _serviceProvider.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        try
        {
            await context.Database.ExecuteSqlRawAsync(EnsureTableSql, cancellationToken).ConfigureAwait(false);
            _logger.OutboxTableVerified();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.OutboxTableEnsureFailed(ex);
            throw;
        }
        }
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
