using Enterprise.Platform.DtoGen;

// DtoGen — offline code generator that reads EF-scaffolded entity files and emits:
//   1. {Entity}Dto.cs      -> Contracts/DTOs/<DbName>/
//   2. {DbName}MappingRegistry.cs + Mapster TypeAdapterConfig -> Infrastructure/Persistence/<DbName>/Mappings/
//
// Invoked manually (or via a pre-build target) after `dotnet ef dbcontext scaffold`.
// The actual generator implementation lands in Phase 6 of the foundation plan
// (Docs/Implementation/00-Foundation-TODO.md) once real entity files exist to parse.

return await CommandLine.RunAsync(args);
