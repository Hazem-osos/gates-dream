-- Phase 3 (H6): aging must run off a real due date, not the invoice date.
--
-- Adds `paymentTermsDays` (credit terms) to Customer/Supplier, used to
-- derive `Invoice.dueDate` when no explicit due date is supplied. Existing
-- rows get `dueDate = NULL`, which callers must treat as "due on `date`"
-- (see aged-open-items.service.ts).
ALTER TABLE `customers` ADD COLUMN `paymentTermsDays` INT NULL;
ALTER TABLE `suppliers` ADD COLUMN `paymentTermsDays` INT NULL;
ALTER TABLE `invoices` ADD COLUMN `dueDate` DATETIME(3) NULL;
