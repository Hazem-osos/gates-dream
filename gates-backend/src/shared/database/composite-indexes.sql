-- Composite Indexes for Common Query Patterns
-- These indexes optimize frequently used query patterns
-- Note: MySQL-compatible syntax (no partial indexes with WHERE clause)
--
-- M13 fix (Item 40): every column reference below was snake_case
-- (`company_id`, `is_posted`, …), but Prisma emits camelCase column names
-- by default (`companyId`, `isPosted`, …) — this file has never been a
-- runnable migration (nothing in `src/`/`scripts/` executes it; grep
-- confirms its only reference is the docs pointer in
-- `docs/performance/query-optimization.md`), so every `CREATE INDEX`
-- below would have failed with "unknown column" had anyone actually run
-- it against the real schema. Corrected to the real column names.
--
-- This is now a reference list only, not applied migration history.
-- Most of it duplicates `@@index`/`@@unique` attributes already declared
-- in `schema.prisma`; the handful that were genuinely missing (confirmed
-- via `SHOW INDEX` — see migration
-- 20260821100000_apply_missing_composite_indexes for why: the older
-- `20251122234024_add_composite_indexes` migration was recorded
-- `applied` in `_prisma_migrations` despite never actually running, after
-- 5 failed attempts were rolled back) have now been created for real by
-- that migration.

-- Accounting Module Indexes

-- Journal Entries: Company + Date queries
-- Already covered by `@@index([companyId, date])` on `JournalEntry` in schema.prisma.
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_date
ON journal_entries(companyId, date DESC);

-- Journal Entries: Company + Status queries
-- Partially covered by `@@index([companyId, postingStatus])`; this variant adds isApproved.
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_status
ON journal_entries(companyId, isPosted, isApproved);

-- Journal Entry Lines: Journal Entry + Account
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry_account
ON journal_entry_lines(journalEntryId, accountId);

-- Accounts: Company + Code (for lookups)
CREATE INDEX IF NOT EXISTS idx_accounts_company_code
ON accounts(companyId, code);

-- Accounts: Company + Active status
-- Note: MySQL doesn't support partial indexes with WHERE clause
-- This index covers all rows, filter in application queries
CREATE INDEX IF NOT EXISTS idx_accounts_company_active
ON accounts(companyId, isActive);

-- Customers: Company + Code
CREATE INDEX IF NOT EXISTS idx_customers_company_code
ON customers(companyId, code);

-- Suppliers: Company + Code
CREATE INDEX IF NOT EXISTS idx_suppliers_company_code
ON suppliers(companyId, code);

-- Inventory Module Indexes

-- Invoices: Company + Type + Date
CREATE INDEX IF NOT EXISTS idx_invoices_company_type_date
ON invoices(companyId, invoiceType, date DESC);

-- Invoices: Company + Status
CREATE INDEX IF NOT EXISTS idx_invoices_company_status
ON invoices(companyId, isPosted, isApproved);

-- Invoice Lines: Invoice + Item
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_item
ON invoice_lines(invoiceId, itemId);

-- Items: Company + Active
-- Note: MySQL doesn't support partial indexes with WHERE clause
-- This index covers all rows, filter in application queries
CREATE INDEX IF NOT EXISTS idx_items_company_active
ON items(companyId, isActive);

-- Item Quantities: Item + Warehouse
CREATE INDEX IF NOT EXISTS idx_item_quantities_item_warehouse
ON item_quantities(itemId, warehouseId);

-- HR Module Indexes

-- Employees: Company + Active
-- Note: MySQL doesn't support partial indexes with WHERE clause
-- This index covers all rows, filter in application queries
CREATE INDEX IF NOT EXISTS idx_employees_company_active
ON employees(companyId, isActive);

-- Employee Contracts: Employee + Active
-- Note: MySQL doesn't support partial indexes with WHERE clause
-- This index covers all rows, filter in application queries
CREATE INDEX IF NOT EXISTS idx_employee_contracts_employee_active
ON employee_contracts(employeeId, isActive);

-- Monthly Salaries: Company + Period
CREATE INDEX IF NOT EXISTS idx_monthly_salaries_company_period
ON monthly_salaries(companyId, periodYear, periodMonth);

-- Monthly Salaries: Employee + Period
CREATE INDEX IF NOT EXISTS idx_monthly_salaries_employee_period
ON monthly_salaries(employeeId, periodYear, periodMonth);

-- Schools Module Indexes

-- Students: Company + Stage
CREATE INDEX IF NOT EXISTS idx_students_company_stage
ON students(companyId, stageId);

-- Student Installments: Student + Date
CREATE INDEX IF NOT EXISTS idx_student_installments_student_date
ON student_installments(studentId, date DESC);

-- Student Installments: Student + Paid status
CREATE INDEX IF NOT EXISTS idx_student_installments_student_paid
ON student_installments(studentId, isPaid);

-- Note: `audit_logs` (and this index) was dropped — see the C12 fix
-- (Item 38) comments in schema.prisma / migration
-- 20260821070000_drop_dead_audit_log_table. Audit trail queries now go
-- through `activity_logs` below (`ActivityLog`, `kind = 'document-audit'`).

-- Activity Logs: Tenant + Kind + Date
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_kind_date
ON activity_logs(tenantId, kind, at DESC);

-- Note: Run these indexes as migrations or manually in production
-- They will improve query performance significantly
