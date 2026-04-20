using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Features.EventShopper.Roles.Queries;
using Enterprise.Platform.Infrastructure.BackgroundJobs;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Worker.Jobs;

/// <summary>
/// Pre-warms the distributed cache for hot lookups so the first user-facing request
/// doesn't pay the cold-start penalty. Runs every 15 minutes. Each cycle opens a DI
/// scope, resolves the dispatcher, and issues a handful of well-known queries — the
/// Phase-4 <c>CachingBehavior</c> stores the results under their declared
/// <see cref="Enterprise.Platform.Application.Abstractions.Behaviors.ICacheable.CacheKey"/>
/// automatically.
/// </summary>
/// <remarks>
/// Extend by adding more queries. Each warmup must be idempotent and read-only; the
/// job swallows failures per-query so a single broken warmup doesn't tank the others.
/// </remarks>
public sealed class CacheWarmupJob : BaseBackgroundJob
{
    private readonly IServiceScopeFactory _scopeFactory;

    /// <summary>Initializes the job.</summary>
    public CacheWarmupJob(IServiceScopeFactory scopeFactory, ILogger<CacheWarmupJob> logger)
        : base(logger)
    {
        _scopeFactory = scopeFactory ?? throw new ArgumentNullException(nameof(scopeFactory));
    }

    /// <inheritdoc />
    protected override TimeSpan Interval => TimeSpan.FromMinutes(15);

    /// <inheritdoc />
    protected override async Task ExecuteCycleAsync(CancellationToken stoppingToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var dispatcher = scope.ServiceProvider.GetRequiredService<IDispatcher>();

        await WarmAsync(
            "roles:list default page",
            () => dispatcher.QueryAsync(new ListRolesQuery(), stoppingToken),
            stoppingToken).ConfigureAwait(false);

        // Future warmups land here; each wrapped in WarmAsync so isolated failures
        // don't abort the cycle.
    }

    private async Task WarmAsync(string description, Func<Task> operation, CancellationToken ct)
    {
        try
        {
            await operation().ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
#pragma warning disable CA1848 // Per-warmup failure is rare; per-query source-gen methods would add ceremony
            Logger.LogWarning(ex, "Cache warmup step '{Step}' failed — continuing.", description);
#pragma warning restore CA1848
        }
    }
}
