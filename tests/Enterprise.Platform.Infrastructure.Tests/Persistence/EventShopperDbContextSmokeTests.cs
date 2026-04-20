using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Infrastructure;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Enterprise.Platform.Infrastructure.Tests.Persistence;

/// <summary>
/// Phase 6 smoke test — verifies the end-to-end wiring of <see cref="EventShopperDbContext"/>
/// through <see cref="IDbContextFactory"/> against the live developer database. Requires
/// a reachable local <c>EventShopperDb</c> and is therefore tagged with an xUnit trait so
/// CI can skip it when the DB isn't available.
/// </summary>
public sealed class EventShopperDbContextSmokeTests
{
    private const string ConnectionString =
        "Data Source=localhost;Initial Catalog=EventShopperDb;Integrated Security=True;Encrypt=True;TrustServerCertificate=True";

    [Fact]
    [Trait("Category", "Integration")]
    public async Task EventShopperDbContext_resolves_from_factory_and_queries_live_database()
    {
        // Arrange — build a minimal host configuration + DI container mirroring production wiring.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:EventShopperDb"] = ConnectionString,
                ["DatabaseSettings:DefaultConnection"] = EventShopperServiceCollectionExtensions.LogicalName,
                ["DatabaseSettings:Connections:EventShopper:ConnectionStringName"] =
                    EventShopperServiceCollectionExtensions.ConnectionStringName,
                ["DatabaseSettings:Connections:EventShopper:Provider"] = "SqlServer",
                ["DatabaseSettings:Connections:EventShopper:CommandTimeoutSeconds"] = "30",
            })
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddInfrastructure(configuration);
        services.AddEventShopperDb(configuration);

        await using var provider = services.BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();

        // Act — resolve via the factory (the interface Application-tier handlers consume).
        var factory = scope.ServiceProvider.GetRequiredService<IDbContextFactory>();
        var context = factory.GetContext<EventShopperDbContext>();

        // Assert — context is alive and at least one table query round-trips through the provider.
        Assert.NotNull(context);

        var roles = await context.Roles.AsNoTracking().Take(1).ToListAsync();
        // We don't assert on count (DB content varies); a successful query means the
        // context, provider, connection string, and scaffolded entity all wire correctly.
        Assert.NotNull(roles);
    }

    [Fact]
    [Trait("Category", "Unit")]
    public void RegisterDbContext_binds_default_logical_name()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:EventShopperDb"] = ConnectionString,
            })
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddInfrastructure(configuration);
        services.AddEventShopperDb(configuration);

        using var provider = services.BuildServiceProvider();
        var registry = provider.GetRequiredService<Enterprise.Platform.Infrastructure.Persistence.DbContextRegistry>();

        Assert.Equal(EventShopperServiceCollectionExtensions.LogicalName, registry.DefaultLogicalName);
        Assert.Contains(EventShopperServiceCollectionExtensions.LogicalName, registry.LogicalNames);
    }
}
