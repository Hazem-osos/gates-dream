-- Invoice line inline grid: cost center, WHT, batch allocations, apparel, custom revenue.

ALTER TABLE `invoice_lines`
  ADD COLUMN `costCenterId` VARCHAR(191) NULL,
  ADD COLUMN `withholdingTaxRate` DECIMAL(8, 4) NULL DEFAULT 0,
  ADD COLUMN `withholdingTaxAmount` DECIMAL(18, 4) NULL DEFAULT 0,
  ADD COLUMN `batchAllocations` JSON NULL,
  ADD COLUMN `color` VARCHAR(191) NULL,
  ADD COLUMN `size` VARCHAR(191) NULL,
  ADD COLUMN `customRevenueAccountId` VARCHAR(191) NULL;

CREATE INDEX `invoice_lines_costCenterId_idx` ON `invoice_lines`(`costCenterId`);
CREATE INDEX `invoice_lines_customRevenueAccountId_idx` ON `invoice_lines`(`customRevenueAccountId`);

ALTER TABLE `invoice_lines`
  ADD CONSTRAINT `invoice_lines_costCenterId_fkey`
    FOREIGN KEY (`costCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `invoice_lines_customRevenueAccountId_fkey`
    FOREIGN KEY (`customRevenueAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
