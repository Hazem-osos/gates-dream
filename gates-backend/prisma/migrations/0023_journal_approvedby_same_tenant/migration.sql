-- Ensure journal entry approvedBy is from same company (MySQL version)
-- Note: Prisma doesn't support DELIMITER, so triggers are simplified

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS `check_approved_by_same_company_insert`;
DROP TRIGGER IF EXISTS `check_approved_by_same_company_update`;

-- Note: Complex triggers with BEGIN/END blocks require DELIMITER which Prisma doesn't support
-- This validation is handled at the application level in the journal entry service

SELECT 'ApprovedBy validation - handled at application level for MySQL' AS note;
