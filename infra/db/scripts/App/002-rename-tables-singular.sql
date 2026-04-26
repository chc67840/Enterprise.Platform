-- ──────────────────────────────────────────────────────────────────────────────
-- 002-rename-tables-singular.sql
--
-- Aligns table names with the CONVENTIONS.md §4 update from plural → singular.
-- 001-initial.sql created `Users` and `PlatformOutboxMessages`; we rename
-- in-place via sp_rename so existing data + indexes + constraints are preserved.
--
-- Why this matters: EF Core's scaffolder uses the table name verbatim as the
-- C# class name. Singular tables → `User`, `PlatformOutboxMessage` (matches
-- .NET conventions); the DbContext members stay plural by manual config.
-- ──────────────────────────────────────────────────────────────────────────────

IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.User', N'U') IS NULL
    EXEC sp_rename N'dbo.Users', N'User';
GO

IF OBJECT_ID(N'dbo.PlatformOutboxMessages', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.PlatformOutboxMessage', N'U') IS NULL
    EXEC sp_rename N'dbo.PlatformOutboxMessages', N'PlatformOutboxMessage';
GO

-- sp_rename keeps index names by default. The IX_Users_* / IX_PlatformOutboxMessages_*
-- index names mention the OLD table; rename them too so the catalog stays self-consistent.
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_Email')
    EXEC sp_rename N'dbo.[User].IX_Users_Email', N'IX_User_Email', N'INDEX';
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Users_ExternalIdentityId')
    EXEC sp_rename N'dbo.[User].UX_Users_ExternalIdentityId', N'UX_User_ExternalIdentityId', N'INDEX';
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PlatformOutboxMessages_PublishedAt_NextAttemptAt')
    EXEC sp_rename N'dbo.PlatformOutboxMessage.IX_PlatformOutboxMessages_PublishedAt_NextAttemptAt',
                   N'IX_PlatformOutboxMessage_PublishedAt_NextAttemptAt', N'INDEX';
GO

-- Constraints (PK / DF) are also renamed for consistency. sp_rename understands
-- them when prefixed with the schema; default constraint names follow the table.
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = N'PK_Users')
    EXEC sp_rename N'dbo.PK_Users', N'PK_User';
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE name = N'PK_PlatformOutboxMessages')
    EXEC sp_rename N'dbo.PK_PlatformOutboxMessages', N'PK_PlatformOutboxMessage';
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE name = N'DF_Users_IsActive')
    EXEC sp_rename N'dbo.DF_Users_IsActive', N'DF_User_IsActive';
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE name = N'DF_Users_CreatedAt')
    EXEC sp_rename N'dbo.DF_Users_CreatedAt', N'DF_User_CreatedAt';
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE name = N'DF_Users_ModifiedAt')
    EXEC sp_rename N'dbo.DF_Users_ModifiedAt', N'DF_User_ModifiedAt';
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE name = N'DF_Users_IsDeleted')
    EXEC sp_rename N'dbo.DF_Users_IsDeleted', N'DF_User_IsDeleted';
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE name = N'DF_PlatformOutboxMessages_OccurredAt')
    EXEC sp_rename N'dbo.DF_PlatformOutboxMessages_OccurredAt', N'DF_PlatformOutboxMessage_OccurredAt';
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE name = N'DF_PlatformOutboxMessages_AttemptCount')
    EXEC sp_rename N'dbo.DF_PlatformOutboxMessages_AttemptCount', N'DF_PlatformOutboxMessage_AttemptCount';
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE name = N'DF_PlatformOutboxMessages_NextAttemptAt')
    EXEC sp_rename N'dbo.DF_PlatformOutboxMessages_NextAttemptAt', N'DF_PlatformOutboxMessage_NextAttemptAt';
GO
