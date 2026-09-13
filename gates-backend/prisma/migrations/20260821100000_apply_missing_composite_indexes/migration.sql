-- M13 fix (Item 40): `20251122234024_add_composite_indexes` is recorded as
-- `applied` in `_prisma_migrations`, but its history shows 5 prior attempts
-- rolled back for syntax errors (`CREATE INDEX IF NOT EXISTS` isn't valid
-- MySQL syntax) and column-casing bugs (`company_id` vs `companyId`) before
-- the final attempt was force-marked applied via `prisma migrate resolve
-- --applied` with `applied_steps_count = 0` — i.e. it was never actually
-- run. `SHOW INDEX` confirms none of its indexes exist on this database.
--
-- Most of what it intended is already covered by `@@index` attributes
-- declared directly in `schema.prisma` (and applied by other migrations),
-- so this migration adds only the composite indexes that are still
-- genuinely missing, using correct camelCase column names.
CREATE INDEX idx_journal_entries_company_status
  ON journal_entries(companyId, isPosted, isApproved);

CREATE INDEX idx_accounts_company_active
  ON accounts(companyId, isActive);

CREATE INDEX idx_customers_company_code
  ON customers(companyId, code);

CREATE INDEX idx_suppliers_company_code
  ON suppliers(companyId, code);

CREATE INDEX idx_invoices_company_status
  ON invoices(companyId, isPosted, isApproved);

CREATE INDEX idx_items_company_active
  ON items(companyId, isActive);

CREATE INDEX idx_employees_company_active
  ON employees(companyId, isActive);

CREATE INDEX idx_employee_contracts_employee_active
  ON employee_contracts(employeeId, isActive);

CREATE INDEX idx_students_company_stage
  ON students(companyId, stageId);

CREATE INDEX idx_student_installments_student_paid
  ON student_installments(studentId, isPaid);
