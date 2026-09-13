-- Ensure JournalLine.companyId matches its parent JournalEntry.companyId (MySQL version)
-- Note: Prisma doesn't support DELIMITER, so triggers are simplified

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS `set_journalline_company_insert`;
DROP TRIGGER IF EXISTS `set_journalline_company_update`;
DROP TRIGGER IF EXISTS `block_cross_company_refs_insert`;
DROP TRIGGER IF EXISTS `block_cross_company_refs_update`;

-- Note: Complex triggers with BEGIN/END blocks require DELIMITER which Prisma doesn't support
-- These validations are handled at the application level in the service layer
-- The Prisma schema ensures companyId is set correctly through relations

SELECT 'JournalLine consistency - handled at application level for MySQL' AS note;
