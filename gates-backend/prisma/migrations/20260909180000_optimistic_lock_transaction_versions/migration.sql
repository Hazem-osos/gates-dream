-- Module 2: optimistic lock on Invoice, Voucher (cash_transactions),
-- and StockTransaction headers. Existing rows keep their current version
-- (0 or 1); only the DEFAULT for new rows becomes 1.

ALTER TABLE `invoices` MODIFY `version` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `cash_transactions` MODIFY `version` INTEGER NOT NULL DEFAULT 1;

ALTER TABLE `transfers` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `issues` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `receipts` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `adjustments` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `opening_stocks` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `stocktaking` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
