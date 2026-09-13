-- Migration: Add Composite Indexes for Query Performance (MySQL)
-- These indexes optimize frequently used query patterns across all modules
-- Note: MySQL-compatible syntax (no partial indexes with WHERE clause)

-- ============================================
-- ACCOUNTING MODULE INDEXES
-- ============================================

-- Journal Entries: Company + Date queries
CREATE INDEX idx_journal_entries_company_date 
ON journal_entries(companyId, date DESC);

-- Journal Entries: Company + Status queries
CREATE INDEX idx_journal_entries_company_status 
ON journal_entries(companyId, isPosted, isApproved);

-- Journal Entry Lines: Journal Entry + Account
CREATE INDEX idx_journal_entry_lines_entry_account 
ON journal_entry_lines(journalEntryId, accountId);

-- Accounts: Company + Code (for lookups)
CREATE INDEX idx_accounts_company_code 
ON accounts(companyId, code);

-- Accounts: Company + Active status
-- Note: MySQL doesn't support partial indexes with WHERE clause
-- This index covers all rows, filter in application queries
CREATE INDEX idx_accounts_company_active 
ON accounts(companyId, isActive);

-- Customers: Company + Code
CREATE INDEX idx_customers_company_code 
ON customers(companyId, code);

-- Suppliers: Company + Code
CREATE INDEX idx_suppliers_company_code 
ON suppliers(companyId, code);

-- ============================================
-- INVENTORY MODULE INDEXES
-- ============================================

-- Invoices: Company + Type + Date
CREATE INDEX idx_invoices_company_type_date 
ON invoices(companyId, invoiceType, date DESC);

-- Invoices: Company + Status
CREATE INDEX idx_invoices_company_status 
ON invoices(companyId, isPosted, isApproved);

-- Invoice Lines: Invoice + Item
CREATE INDEX idx_invoice_lines_invoice_item 
ON invoice_lines(invoiceId, itemId);

-- Items: Company + Active
-- Note: MySQL doesn't support partial indexes with WHERE clause
-- This index covers all rows, filter in application queries
CREATE INDEX idx_items_company_active 
ON items(companyId, isActive);

-- Item Quantities: Item + Warehouse
CREATE INDEX idx_item_quantities_item_warehouse 
ON item_quantities(itemId, warehouseId);

-- ============================================
-- HR MODULE INDEXES
-- ============================================

-- Employees: Company + Active
-- Note: MySQL doesn't support partial indexes with WHERE clause
-- This index covers all rows, filter in application queries
CREATE INDEX idx_employees_company_active 
ON employees(companyId, isActive);

-- Employee Contracts: Employee + Active
-- Note: MySQL doesn't support partial indexes with WHERE clause
-- This index covers all rows, filter in application queries
CREATE INDEX idx_employee_contracts_employee_active 
ON employee_contracts(employeeId, isActive);

-- Monthly Salaries: Company + Period
CREATE INDEX idx_monthly_salaries_company_period 
ON monthly_salaries(companyId, periodYear, periodMonth);

-- Monthly Salaries: Employee + Period
CREATE INDEX idx_monthly_salaries_employee_period 
ON monthly_salaries(employeeId, periodYear, periodMonth);

-- ============================================
-- SCHOOLS MODULE INDEXES
-- ============================================

-- Students: Company + Stage
CREATE INDEX idx_students_company_stage 
ON students(companyId, stageId);

-- Student Installments: Student + Date
CREATE INDEX idx_student_installments_student_date 
ON student_installments(studentId, date DESC);

-- Student Installments: Student + Paid status
CREATE INDEX idx_student_installments_student_paid 
ON student_installments(studentId, is_paid);

-- ============================================
-- AUDIT AND LOGGING INDEXES
-- ============================================

-- Audit Logs: Tenant + Table + Date (for audit queries)
CREATE INDEX idx_audit_logs_tenant_table_date 
ON audit_logs(tenantId, tableName, at DESC);

-- Activity Logs: Tenant + Kind + Date
CREATE INDEX idx_activity_logs_tenant_kind_date 
ON activity_logs(tenantId, kind, at DESC);

