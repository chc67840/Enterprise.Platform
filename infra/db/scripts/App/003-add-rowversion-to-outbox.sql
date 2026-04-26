-- ──────────────────────────────────────────────────────────────────────────────
-- 003-add-rowversion-to-outbox.sql
--
-- Adds RowVersion to dbo.PlatformOutboxMessage. Required because
-- the platform's BaseEntity declares a `byte[] RowVersion` property; without
-- a matching column, EF Core would either fail at startup or insert NULL.
--
-- ROWVERSION is a SQL Server pseudo-type (auto-incrementing 8-byte token);
-- safe to add to an existing table — every row gets a value on INSERT/UPDATE
-- including for already-present rows.
-- ──────────────────────────────────────────────────────────────────────────────

IF COL_LENGTH('dbo.PlatformOutboxMessage', 'RowVersion') IS NULL
    ALTER TABLE dbo.PlatformOutboxMessage ADD RowVersion ROWVERSION NOT NULL;
GO
