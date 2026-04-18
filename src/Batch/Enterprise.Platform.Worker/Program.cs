var builder = Host.CreateApplicationBuilder(args);

// Hosted services, background jobs, and DI wiring are registered by later phases
// (Infrastructure.DependencyInjection + Worker/Jobs) per Docs/Architecture/10.

var host = builder.Build();
host.Run();
