using Enterprise.Platform.Application;
using Enterprise.Platform.Application.Abstractions.Messaging;
using Enterprise.Platform.Application.Common.Models;
using Enterprise.Platform.Application.Features.EventShopper.Roles.Commands;
using Enterprise.Platform.Application.Features.EventShopper.Roles.Queries;
using Enterprise.Platform.Contracts.DTOs.EventShopper;
using Enterprise.Platform.Infrastructure;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper;
using Enterprise.Platform.Shared.Results;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Enterprise.Platform.Application.Tests.Features.EventShopper.Roles;

/// <summary>
/// Phase-9 checkpoint. Exercises a query + a command happy path through the full
/// Application pipeline (dispatcher → behaviors → handler → repository → EF) against
/// the live EventShopperDb. Tests bypass the web host (WebApplicationFactory is
/// blocked by local WDAC policy); they go through the same composition the Api host
/// uses, so every behavior (logging, validation, tenant, audit-null, transaction,
/// caching, idempotency) runs as it would in production.
/// </summary>
public sealed class RolesHandlersTests
{
    private const string ConnectionString =
        "Data Source=localhost;Initial Catalog=EventShopperDb;Integrated Security=True;Encrypt=True;TrustServerCertificate=True";

    private static ServiceProvider BuildProvider()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:EventShopperDb"] = ConnectionString,
                ["DatabaseSettings:DefaultConnection"] = EventShopperServiceCollectionExtensions.LogicalName,
                ["DatabaseSettings:Connections:EventShopper:ConnectionStringName"] = EventShopperServiceCollectionExtensions.ConnectionStringName,
                ["DatabaseSettings:Connections:EventShopper:Provider"] = "SqlServer",
                ["DatabaseSettings:Connections:EventShopper:CommandTimeoutSeconds"] = "30",
                ["MultiTenancy:RequireResolvedTenant"] = "false",
                ["Cache:Provider"] = "InMemory",
            })
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddApplication(configuration);
        services.AddInfrastructure(configuration);
        services.AddEventShopperDb(configuration);
        return services.BuildServiceProvider();
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task ListRoles_returns_existing_rows_from_live_database()
    {
        // Arrange
        await using var provider = BuildProvider();
        await using var scope = provider.CreateAsyncScope();
        var dispatcher = scope.ServiceProvider.GetRequiredService<IDispatcher>();

        // Act
        var result = await dispatcher.QueryAsync(new ListRolesQuery(PageNumber: 1, PageSize: 10));

        // Assert
        Assert.True(result.IsSuccess, result.IsFailure ? result.Error.Message : "");
        var page = result.Value;
        Assert.NotNull(page);
        Assert.True(page.TotalCount >= 0);
        Assert.NotNull(page.Items);
        Assert.True(page.Items.Count <= 10);
        foreach (var dto in page.Items)
        {
            Assert.IsType<RolesDto>(dto);
            Assert.False(string.IsNullOrEmpty(dto.Name));
        }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task GetRoleById_for_missing_id_returns_not_found_error()
    {
        await using var provider = BuildProvider();
        await using var scope = provider.CreateAsyncScope();
        var dispatcher = scope.ServiceProvider.GetRequiredService<IDispatcher>();

        var result = await dispatcher.QueryAsync(new GetRoleByIdQuery(-1));

        Assert.True(result.IsFailure);
        Assert.Equal(ErrorCodes.NotFound, result.Error.Code);
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task CreateRole_then_GetRoleById_round_trips_successfully()
    {
        await using var provider = BuildProvider();
        await using var scope = provider.CreateAsyncScope();
        var dispatcher = scope.ServiceProvider.GetRequiredService<IDispatcher>();

        // Unique name per run so repeated test execution doesn't collide on the unique index.
        var uniqueName = $"test-role-{Guid.NewGuid():N}"[..24];
        var command = new CreateRoleCommand(uniqueName, "Phase-9 checkpoint role.", Priority: 500, IsActive: true);

        var createResult = await dispatcher.SendAsync(command);
        Assert.True(createResult.IsSuccess, createResult.IsFailure ? createResult.Error.Message : "");
        var newId = createResult.Value;
        Assert.True(newId > 0);

        var getResult = await dispatcher.QueryAsync(new GetRoleByIdQuery(newId));
        Assert.True(getResult.IsSuccess);
        Assert.Equal(uniqueName, getResult.Value.Name);

        // Clean-up: soft-delete the row so the test leaves no trace.
        var delResult = await dispatcher.SendAsync(new DeleteRoleCommand(newId, getResult.Value.RowVersion));
        Assert.True(delResult.IsSuccess, delResult.IsFailure ? delResult.Error.Message : "");
    }
}
