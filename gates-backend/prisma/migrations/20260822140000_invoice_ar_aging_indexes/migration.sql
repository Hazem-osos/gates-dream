-- Wave 4 fix: AR aging (dueDate range scans for open receivables/payables)
-- and open-balance listings (remainingAmount > 0, grouped by invoiceKind)
-- had no supporting composite index, forcing a full companyId-index scan
-- plus filesort over every posted invoice for a tenant.
CREATE INDEX idx_invoices_company_posted_cancelled_duedate
  ON invoices(companyId, isPosted, isCancelled, dueDate);

CREATE INDEX idx_invoices_company_kind_posted_cancelled_remaining
  ON invoices(companyId, invoiceKind, isPosted, isCancelled, remainingAmount);
