-- Audit trigger function: captures row-level changes (MySQL version)
-- Note: Prisma doesn't support DELIMITER, so complex triggers are simplified

-- Drop existing triggers and procedures
DROP PROCEDURE IF EXISTS `create_audit_trigger`;
DROP FUNCTION IF EXISTS `audit_row_change`;

-- Note: Complex triggers with BEGIN/END blocks require DELIMITER which Prisma doesn't support
-- Audit logging is handled at the application level in the service layer
-- This provides better control and doesn't require database-level triggers
--
-- C12 fix (Item 38): this comment block originally claimed
-- "JournalEntryService.createJournalEntry() logs to audit_logs" / "... logs
-- changes" — that never happened (the `audit_logs` table, since removed,
-- had zero writers in the whole codebase). Document/journal-entry audit
-- logging is implemented via `documentAuditService.record(...)`
-- (`src/modules/accounting/services/document-audit.service.ts`), which
-- writes to `activity_logs` (`ActivityLog` model) from inside the same
-- posting transaction — see `journalPostingService.createJournalEntry` /
-- `createAndPostInTx` / `reverseJournalEntryInTx` / `updateJournalEntry` /
-- `postJournalEntry` / `unpostJournalEntry`.

SELECT 'Audit triggers - handled at application level for MySQL' AS note;
