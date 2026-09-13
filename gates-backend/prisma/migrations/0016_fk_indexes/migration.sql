-- Foreign key indexes for performance (MySQL version)

-- Add indexes on foreign key columns for better join performance
-- These are typically created automatically by MySQL, but we can add composite indexes

-- Example: Add composite indexes for common query patterns
-- CREATE INDEX IF NOT EXISTS `idx_journalline_entry_account` ON `journal_entry_lines` (`journalEntryId`, `accountId`);
-- CREATE INDEX IF NOT EXISTS `idx_journalline_account_costcenter` ON `journal_entry_lines` (`accountId`, `costCenterId`);

SELECT 'FK indexes - add as needed based on query patterns' AS note;
