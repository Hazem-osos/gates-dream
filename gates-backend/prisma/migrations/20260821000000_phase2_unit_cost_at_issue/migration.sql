-- Phase 2 (costing): capture the unit cost actually charged to COGS/inventory
-- at post time on each invoice line, so returns can reverse at the true
-- original cost instead of whatever the average cost happens to be later.
ALTER TABLE `invoice_lines` ADD COLUMN `unitCostAtIssue` DECIMAL(18, 4) NULL;
