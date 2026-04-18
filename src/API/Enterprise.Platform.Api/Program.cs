var builder = WebApplication.CreateBuilder(args);

// Service registration, middleware, and endpoint groups are configured by
// ServiceCollectionExtensions / WebApplicationExtensions in later phases.
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.Run();
