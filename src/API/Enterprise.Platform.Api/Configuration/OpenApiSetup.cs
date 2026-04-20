namespace Enterprise.Platform.Api.Configuration;

/// <summary>
/// Uses .NET 10's built-in <c>Microsoft.AspNetCore.OpenApi</c> document generator.
/// Hosts map the JSON document at <c>/openapi/v1.json</c> in <c>Program.cs</c>; a
/// UI (Scalar, Swagger UI, Redoc) can be layered in Dev without coupling the API
/// assembly to it. Security requirements are attached per-endpoint via
/// <c>.RequireAuthorization(...)</c>; the generator picks them up automatically.
/// </summary>
public static class OpenApiSetup
{
    /// <summary>Registers the OpenAPI document generator.</summary>
    public static IServiceCollection AddPlatformOpenApi(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddOpenApi("v1", options =>
        {
            options.AddDocumentTransformer((document, _, _) =>
            {
                document.Info.Title = "Enterprise.Platform API";
                document.Info.Version = "v1";
                document.Info.Description = "Primary Api surface. DTOs live in Enterprise.Platform.Contracts.";
                return Task.CompletedTask;
            });
        });

        return services;
    }
}
