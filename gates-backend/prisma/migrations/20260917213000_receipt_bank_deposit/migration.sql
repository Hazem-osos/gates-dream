ALTER TABLE `securities_receipts`
  ADD COLUMN `depositAccountId` VARCHAR(191) NULL,
  ADD COLUMN `depositDate` DATETIME(3) NULL;
