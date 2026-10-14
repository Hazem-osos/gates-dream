-- Tender header details from product notebook (consultant, PM, funding, award terms).
-- Work-item catalog (دليل بنود الأعمال) independent of a project.

ALTER TABLE `contract_tenders`
  ADD COLUMN `consultantName` VARCHAR(255) NULL,
  ADD COLUMN `projectManagerName` VARCHAR(255) NULL,
  ADD COLUMN `fundingSource` VARCHAR(255) NULL,
  ADD COLUMN `delayPenaltyRate` DECIMAL(8, 6) NULL,
  ADD COLUMN `contractDurationDays` INT NULL;

ALTER TABLE `contract_tender_boq_items`
  ADD COLUMN `kind` VARCHAR(32) NULL;

CREATE TABLE `contracting_work_item_catalog` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `itemCode` VARCHAR(64) NOT NULL,
  `descriptionAr` VARCHAR(500) NOT NULL,
  `descriptionEn` VARCHAR(500) NULL,
  `unit` ENUM('M2', 'M3', 'TON', 'ITEM', 'LM', 'LS') NOT NULL DEFAULT 'ITEM',
  `kind` ENUM('SEASON', 'CHAPTER', 'OFFICIAL', 'EXECUTABLE') NOT NULL DEFAULT 'EXECUTABLE',
  `groupName` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `contracting_work_item_catalog_companyId_itemCode_key` (`companyId`, `itemCode`),
  INDEX `contracting_work_item_catalog_companyId_kind_idx` (`companyId`, `kind`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `contracting_work_item_catalog`
  ADD CONSTRAINT `contracting_work_item_catalog_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
