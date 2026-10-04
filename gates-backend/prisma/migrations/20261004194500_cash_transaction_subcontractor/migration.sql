-- P0-3: treasury party identity for subcontract settlement (not Supplier).
ALTER TABLE `cash_transactions` ADD COLUMN `subcontractorId` VARCHAR(191) NULL;

CREATE INDEX `cash_tx_co_subcontractor_idx` ON `cash_transactions`(`companyId`, `subcontractorId`);

ALTER TABLE `cash_transactions` ADD CONSTRAINT `cash_transactions_subcontractorId_fkey`
  FOREIGN KEY (`subcontractorId`) REFERENCES `subcontractors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
