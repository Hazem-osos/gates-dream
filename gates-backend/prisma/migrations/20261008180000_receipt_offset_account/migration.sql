-- Per-receipt override for goods-receipt GL credit (الحساب الوسيط).
ALTER TABLE `receipts`
  ADD COLUMN `offsetAccountId` VARCHAR(191) NULL;

CREATE INDEX `receipts_offsetAccountId_idx` ON `receipts`(`offsetAccountId`);

ALTER TABLE `receipts`
  ADD CONSTRAINT `receipts_offsetAccountId_fkey`
    FOREIGN KEY (`offsetAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
