namespace Enterprise.Platform.Infrastructure.Persistence.App.Mappings;

/// <summary>
/// Marker class whose assembly is scanned by Mapster (see
/// <c>AppServiceCollectionExtensions.AddAppDb</c>) to discover
/// <c>IRegister</c> implementations. Empty today — populated as DTO mappings
/// are added per aggregate (one <c>{Aggregate}Mappings.cs</c> file per aggregate
/// implementing <c>IRegister</c>).
/// </summary>
public sealed class AppMappingRegistry
{
}
