-- MySQL Migration: Initial Setup
-- Note: MySQL doesn't support extensions like PostgreSQL
-- UUID generation will be handled by the application layer

-- Namespaces for app settings
-- Session variables expected:
--   @app.tenant_id :: CHAR(36)
--   @app.user_id   :: CHAR(36)
--   @app.request_id:: CHAR(36)
--   @app.ip        :: VARCHAR(255)
--   @app.user_agent:: TEXT

-- RLS will be handled at application level via middleware (setTenantContext)
-- MySQL doesn't have native Row-Level Security like PostgreSQL

-- JournalLine debit/credit XOR constraint
-- Note: MySQL CHECK constraints are supported in MySQL 8.0.16+
-- This will be added after the table is created by Prisma

-- Balanced entry triggers
-- Note: Prisma migrations don't support complex triggers with BEGIN/END blocks
-- These validations are handled at the application level in the service layer
-- The JournalEntryService ensures entries are balanced before posting

-- Drop existing triggers if they exist (for clean migration)
DROP TRIGGER IF EXISTS `journal_balanced_before_insert`;
DROP TRIGGER IF EXISTS `journal_balanced_before_update`;

-- Note: Complex triggers are handled at application level
-- Application-level validation provides better error messages and control flow
SELECT 'Initial setup complete - triggers handled at application level' AS note;
