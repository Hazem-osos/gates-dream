-- Company ID RLS policies (MySQL version)
-- Note: MySQL doesn't support RLS - handled at application level

-- All tables with companyId are filtered by application middleware (setTenantContext)
-- No database-level RLS policies needed

SELECT 'Company ID filtering handled at application level for MySQL' AS note;
