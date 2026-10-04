ALTER TABLE `securities_receipts`
  ADD COLUMN `isOpening` BOOLEAN NOT NULL DEFAULT false,
  ADD INDEX `securities_receipts_companyId_isOpening_idx` (`companyId`, `isOpening`);
