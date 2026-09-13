-- Prevent updates to posted journal entries and their lines (MySQL version)
-- Note: Prisma doesn't support DELIMITER, so triggers are simplified

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS `prevent_update_if_posted_entry`;
DROP TRIGGER IF EXISTS `prevent_update_line_if_posted`;
DROP TRIGGER IF EXISTS `prevent_update_line_if_posted_update`;
DROP TRIGGER IF EXISTS `prevent_delete_line_if_posted`;

-- Note: Complex triggers with BEGIN/END blocks require DELIMITER which Prisma doesn't support
-- These triggers will be created manually after migration, or handled at application level
-- Application-level validation is recommended for posted entries

SELECT 'Posting rules - triggers can be added manually or handled at application level' AS note;
