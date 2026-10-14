-- Selling-study rates on tenders, award terms on contracts, BOQ header flag,
-- and cost-element catalogs (materials / labor / equipment / site / sub).

ALTER TABLE `contract_tenders`
  ADD COLUMN `profitMarginRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.120000,
  ADD COLUMN `contractTaxesRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.000000;

ALTER TABLE `contract_tender_boq_items`
  ADD COLUMN `isExecutable` BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE `contract_tender_boq_items`
SET `isExecutable` = FALSE
WHERE `kind` IN ('SEASON', 'CHAPTER', 'OFFICIAL');

ALTER TABLE `client_contracts`
  ADD COLUMN `plannedStart` DATETIME(3) NULL,
  ADD COLUMN `plannedEnd` DATETIME(3) NULL,
  ADD COLUMN `contractDurationDays` INT NULL,
  ADD COLUMN `delayPenaltyRate` DECIMAL(8, 6) NULL;

CREATE TABLE `contracting_cost_element_catalog` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `costElementType` ENUM('MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'SITE_EXPENSE') NOT NULL,
  `resourceCode` VARCHAR(64) NOT NULL,
  `descriptionAr` VARCHAR(255) NOT NULL,
  `unit` VARCHAR(20) NOT NULL,
  `unitCost` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `contracting_cost_element_catalog_company_type_code_key` (`companyId`, `costElementType`, `resourceCode`),
  INDEX `contracting_cost_element_catalog_companyId_costElementType_idx` (`companyId`, `costElementType`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `contracting_cost_element_catalog`
  ADD CONSTRAINT `contracting_cost_element_catalog_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
