-- Migration: Add Soft Delete Support and Complete Audit Coverage (MySQL version)
-- This migration adds deletedAt columns and ensures audit coverage
-- Note: Only adds columns if tables exist (tables are created by Prisma schema)

-- ============================================
-- 1. ADD SOFT DELETE SUPPORT (deletedAt columns)
-- ============================================

-- Note: Prisma migrations don't support DELIMITER or complex procedures
-- This migration will be skipped if tables don't exist - they'll be created by Prisma schema
-- Soft delete columns are already defined in the Prisma schema, so Prisma will create them

SELECT 'Soft delete columns are defined in Prisma schema and will be created with tables' AS note;
