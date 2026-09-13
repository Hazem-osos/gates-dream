-- Phase 4 (C10/H12): POS orders must post a real journal entry at order time
-- instead of waiting for shift close, and POS lines need discountPercent
-- support to match invoice line math.
ALTER TABLE `pos_orders` ADD COLUMN `journalEntryId` VARCHAR(191) NULL;
CREATE INDEX `pos_orders_journalEntryId_idx` ON `pos_orders`(`journalEntryId`);
ALTER TABLE `pos_orders`
  ADD CONSTRAINT `pos_orders_journalEntryId_fkey`
  FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `pos_order_lines` ADD COLUMN `discountPercent` DECIMAL(5, 2) NULL;
