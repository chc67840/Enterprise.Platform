-- ──────────────────────────────────────────────────────────────────────────────
-- 001-initial.sql — first schema for the App database (EnterprisePlatform).
--
-- Creates:
--   dbo.Users
--   dbo.PlatformOutboxMessages
--   IX_Users_Email                    (unique)
--   UX_Users_ExternalIdentityId       (unique, filtered NOT NULL)
--   IX_PlatformOutboxMessages_PublishedAt_NextAttemptAt
--
-- Authoring rules: see infra/db/CONVENTIONS.md.
-- Re-runnable: every CREATE/ALTER is wrapped in IF NOT EXISTS or IF COL_LENGTH.
-- ──────────────────────────────────────────────────────────────────────────────

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users
    (
        Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Users PRIMARY KEY DEFAULT (NEWSEQUENTIALID()),
        Email               NVARCHAR(254)    NOT NULL,
        FirstName           NVARCHAR(100)    NOT NULL,
        LastName            NVARCHAR(100)    NOT NULL,
        ExternalIdentityId  UNIQUEIDENTIFIER NULL,
        IsActive            BIT              NOT NULL CONSTRAINT DF_Users_IsActive  DEFAULT (1),
        LastLoginAt         DATETIMEOFFSET(7)     NULL,
        CreatedAt           DATETIMEOFFSET(7)     NOT NULL CONSTRAINT DF_Users_CreatedAt  DEFAULT (SYSUTCDATETIME()),
        CreatedBy           NVARCHAR(256)    NULL,
        ModifiedAt          DATETIMEOFFSET(7)     NOT NULL CONSTRAINT DF_Users_ModifiedAt DEFAULT (SYSUTCDATETIME()),
        ModifiedBy          NVARCHAR(256)    NULL,
        IsDeleted           BIT              NOT NULL CONSTRAINT DF_Users_IsDeleted  DEFAULT (0),
        DeletedAt           DATETIMEOFFSET(7)     NULL,
        DeletedBy           NVARCHAR(256)    NULL,
        RowVersion          ROWVERSION       NOT NULL
    );
END
GO

-- Email is unique platform-wide. The value-object layer used to enforce
-- lower-casing on write; in db-first, FluentValidation + a future
-- CK_Users_EmailLower check constraint cover that.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_Email' AND object_id = OBJECT_ID(N'dbo.Users'))
    CREATE UNIQUE INDEX IX_Users_Email ON dbo.Users(Email);
GO

-- ExternalIdentityId is unique-when-present (one Entra/IdP subject per user)
-- but NULL is allowed for users created administratively before linking.
-- Filtered unique index is the canonical SQL Server pattern for this.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Users_ExternalIdentityId' AND object_id = OBJECT_ID(N'dbo.Users'))
    CREATE UNIQUE INDEX UX_Users_ExternalIdentityId
        ON dbo.Users(ExternalIdentityId)
        WHERE ExternalIdentityId IS NOT NULL;
GO


-- ──────────────────────────────────────────────────────────────────────────────
-- Outbox — durable buffer for integration events. Producer side (writers) inserts
-- inside the same transaction as the aggregate change. Consumer side (Worker)
-- polls for unpublished rows on a timer.
-- ──────────────────────────────────────────────────────────────────────────────

IF OBJECT_ID(N'dbo.PlatformOutboxMessages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PlatformOutboxMessages
    (
        Id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_PlatformOutboxMessages PRIMARY KEY DEFAULT (NEWSEQUENTIALID()),
        EventType       NVARCHAR(512)    NOT NULL,                         -- assembly-qualified event-type name
        Payload         NVARCHAR(MAX)    NOT NULL,                         -- serialised event JSON
        OccurredAt      DATETIMEOFFSET(7)     NOT NULL CONSTRAINT DF_PlatformOutboxMessages_OccurredAt DEFAULT (SYSUTCDATETIME()),
        PublishedAt     DATETIMEOFFSET(7)     NULL,                             -- NULL = pending
        AttemptCount    INT              NOT NULL CONSTRAINT DF_PlatformOutboxMessages_AttemptCount DEFAULT (0),
        NextAttemptAt   DATETIMEOFFSET(7)     NOT NULL CONSTRAINT DF_PlatformOutboxMessages_NextAttemptAt DEFAULT (SYSUTCDATETIME()),
        LastError       NVARCHAR(MAX)    NULL,
        CorrelationId   NVARCHAR(128)    NULL,
        TraceId         NVARCHAR(128)    NULL
    );
END
GO

-- The Worker query: "give me the next batch of pending messages whose retry
-- window has elapsed". An index covering both `PublishedAt` (filter) and
-- `NextAttemptAt` (range scan) keeps the poll cheap even at high backlog.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PlatformOutboxMessages_PublishedAt_NextAttemptAt' AND object_id = OBJECT_ID(N'dbo.PlatformOutboxMessages'))
    CREATE INDEX IX_PlatformOutboxMessages_PublishedAt_NextAttemptAt
        ON dbo.PlatformOutboxMessages(PublishedAt, NextAttemptAt);
GO
