-- Performance indexing sprint — indexes not present in 20251122234024_add_composite_indexes

CREATE INDEX `journal_entries_company_fy_posted_date_idx` ON `journal_entries`(`companyId`, `fiscalYearId`, `isPosted`, `date`);
CREATE INDEX `journal_entry_lines_account_entry_idx` ON `journal_entry_lines`(`accountId`, `journalEntryId`);
CREATE INDEX `invoices_company_branch_posted_type_date_idx` ON `invoices`(`companyId`, `branchId`, `isPosted`, `invoiceType`, `date`);
CREATE INDEX `cash_transactions_company_safe_posted_date_idx` ON `cash_transactions`(`companyId`, `safeId`, `isPosted`, `date`);
CREATE INDEX `inventory_movements_wh_item_docdate_idx` ON `inventory_movements`(`companyId`, `warehouseId`, `itemId`, `documentDate`);
