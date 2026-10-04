-- Opening-stock lines already collect batch and expiry in the form, but the columns did not exist, so the expiry report had nothing to read.
ALTER TABLE `opening_stock_lines`
  ADD COLUMN `batchNumber` VARCHAR(191) NULL,
  ADD COLUMN `expiryDate` DATETIME(3) NULL,
  ADD INDEX `opening_stock_lines_expiryDate_idx` (`expiryDate`);
