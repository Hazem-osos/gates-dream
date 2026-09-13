-- MySQL Migration: RLS Policies
-- Note: MySQL doesn't support Row-Level Security (RLS) like PostgreSQL
-- Tenant isolation is handled at the application level via middleware (setTenantContext)
-- This migration is kept for reference but doesn't create RLS policies

-- Application-level tenant isolation:
-- - All queries are filtered by companyId/tenantId in the application layer
-- - The setTenantContext middleware ensures tenant context is set
-- - Prisma queries automatically include WHERE companyId = ? clauses

-- No database-level RLS needed for MySQL
-- Tenant isolation is enforced through:
-- 1. Application middleware (setTenantContext)
-- 2. Prisma query filtering
-- 3. Service layer validation

SELECT 'RLS handled at application level for MySQL' AS note;
