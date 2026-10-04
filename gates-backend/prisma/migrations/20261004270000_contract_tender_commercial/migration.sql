-- P4 Tender → Quotation → Award commercial stack

CREATE TABLE `contract_tenders` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `tenderNumber` VARCHAR(32) NOT NULL,
  `sequenceNumber` INT NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `nameAr` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `currencyCode` VARCHAR(8) NOT NULL DEFAULT 'EGP',
  `exchangeRate` DECIMAL(18, 6) NULL,
  `submissionDeadline` DATETIME(3) NULL,
  `expectedStart` DATETIME(3) NULL,
  `expectedEnd` DATETIME(3) NULL,
  `location` VARCHAR(255) NULL,
  `status` ENUM('DRAFT','UNDER_STUDY','PRICING','READY_TO_SUBMIT','SUBMITTED','UNDER_NEGOTIATION','AWARDED','LOST','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `lostReason` VARCHAR(255) NULL,
  `competitorName` VARCHAR(255) NULL,
  `lostNotes` TEXT NULL,
  `generalOverheadRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.08,
  `siteOverheadRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.05,
  `contingencyRiskRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.03,
  `defaultMarkupRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.20,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `contract_tenders_companyId_tenderNumber_key`(`companyId`, `tenderNumber`),
  INDEX `contract_tenders_companyId_status_idx`(`companyId`, `status`),
  INDEX `contract_tenders_customerId_idx`(`customerId`),
  CONSTRAINT `contract_tenders_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `contract_tenders_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `contract_tender_boq_items` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `tenderId` VARCHAR(191) NOT NULL,
  `itemCode` VARCHAR(64) NOT NULL,
  `descriptionAr` VARCHAR(500) NOT NULL,
  `unit` ENUM('M2','M3','TON','ITEM','LM','LS') NOT NULL,
  `quantity` DECIMAL(18, 4) NOT NULL,
  `sectionName` VARCHAR(255) NULL,
  `clientSuppliedRate` DECIMAL(18, 4) NULL,
  `notes` TEXT NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `directUnitCost` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `markupRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.20,
  `sellingUnitRate` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `pricingMethod` ENUM('MANUAL_SELLING','COST_PLUS_MARKUP','TARGET_MARGIN') NOT NULL DEFAULT 'COST_PLUS_MARKUP',
  `targetMarginRate` DECIMAL(8, 6) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `contract_tender_boq_items_tenderId_itemCode_key`(`tenderId`, `itemCode`),
  INDEX `contract_tender_boq_items_companyId_idx`(`companyId`),
  CONSTRAINT `contract_tender_boq_items_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `contract_tender_boq_items_tenderId_fkey` FOREIGN KEY (`tenderId`) REFERENCES `contract_tenders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `contract_tender_rate_analysis_items` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `tenderBoqItemId` VARCHAR(191) NOT NULL,
  `costElementType` ENUM('MATERIAL','LABOR','EQUIPMENT','SUBCONTRACTOR','SITE_EXPENSE') NOT NULL,
  `resourceCode` VARCHAR(64) NULL,
  `descriptionAr` VARCHAR(255) NOT NULL,
  `unit` VARCHAR(20) NOT NULL,
  `consumptionQuotaPerUnit` DECIMAL(18, 4) NOT NULL,
  `unitCost` DECIMAL(18, 4) NOT NULL,
  `wasteFactorRate` DECIMAL(8, 6) NOT NULL DEFAULT 0,
  `totalCostPerUnit` DECIMAL(18, 4) NOT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `contract_tender_rate_analysis_items_tenderBoqItemId_idx`(`tenderBoqItemId`),
  CONSTRAINT `contract_tender_rate_analysis_items_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `contract_tender_rate_analysis_items_tenderBoqItemId_fkey` FOREIGN KEY (`tenderBoqItemId`) REFERENCES `contract_tender_boq_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `contract_quotations` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `tenderId` VARCHAR(191) NOT NULL,
  `quotationNumber` VARCHAR(32) NOT NULL,
  `revisionNumber` INT NOT NULL,
  `status` ENUM('DRAFT','SUBMITTED','ACCEPTED','REJECTED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `validUntil` DATETIME(3) NULL,
  `paymentTerms` TEXT NULL,
  `deliveryTerms` TEXT NULL,
  `notes` TEXT NULL,
  `currencyCode` VARCHAR(8) NOT NULL,
  `subtotalSelling` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `discountAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `taxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `grandTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `totalDirectCost` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `expectedProfit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `expectedMarginPercent` DECIMAL(18, 6) NULL,
  `submittedAt` DATETIME(3) NULL,
  `acceptedAt` DATETIME(3) NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `contract_quotations_tenderId_revisionNumber_key`(`tenderId`, `revisionNumber`),
  UNIQUE INDEX `contract_quotations_companyId_quotationNumber_revisionNumber_key`(`companyId`, `quotationNumber`, `revisionNumber`),
  INDEX `contract_quotations_companyId_status_idx`(`companyId`, `status`),
  CONSTRAINT `contract_quotations_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `contract_quotations_tenderId_fkey` FOREIGN KEY (`tenderId`) REFERENCES `contract_tenders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `contract_quotation_lines` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `quotationId` VARCHAR(191) NOT NULL,
  `tenderBoqItemId` VARCHAR(191) NOT NULL,
  `itemCodeSnapshot` VARCHAR(64) NOT NULL,
  `descriptionArSnapshot` VARCHAR(500) NOT NULL,
  `unitSnapshot` ENUM('M2','M3','TON','ITEM','LM','LS') NOT NULL,
  `quantitySnapshot` DECIMAL(18, 4) NOT NULL,
  `directUnitCostSnapshot` DECIMAL(18, 4) NOT NULL,
  `sellingUnitRateSnapshot` DECIMAL(18, 4) NOT NULL,
  `lineAmountSnapshot` DECIMAL(18, 4) NOT NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `contract_quotation_lines_quotationId_idx`(`quotationId`),
  CONSTRAINT `contract_quotation_lines_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `contract_quotation_lines_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `contract_quotations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `contract_quotation_lines_tenderBoqItemId_fkey` FOREIGN KEY (`tenderBoqItemId`) REFERENCES `contract_tender_boq_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `contract_tender_awards` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `tenderId` VARCHAR(191) NOT NULL,
  `quotationId` VARCHAR(191) NOT NULL,
  `clientContractId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(128) NULL,
  `awardedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `awardedBy` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `contract_tender_awards_tenderId_key`(`tenderId`),
  UNIQUE INDEX `contract_tender_awards_quotationId_key`(`quotationId`),
  UNIQUE INDEX `contract_tender_awards_clientContractId_key`(`clientContractId`),
  UNIQUE INDEX `contract_tender_awards_projectId_key`(`projectId`),
  UNIQUE INDEX `contract_tender_awards_idempotencyKey_key`(`idempotencyKey`),
  CONSTRAINT `contract_tender_awards_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `contract_tender_awards_tenderId_fkey` FOREIGN KEY (`tenderId`) REFERENCES `contract_tenders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `contract_quotations_award_fkey` FOREIGN KEY (`quotationId`) REFERENCES `contract_quotations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `contract_tender_awards_clientContractId_fkey` FOREIGN KEY (`clientContractId`) REFERENCES `client_contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `contract_tender_awards_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `contracting_projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `contracting_projects` ADD COLUMN `sourceTenderId` VARCHAR(191) NULL;
ALTER TABLE `client_contracts` ADD COLUMN `sourceTenderId` VARCHAR(191) NULL, ADD COLUMN `sourceQuotationId` VARCHAR(191) NULL;
ALTER TABLE `project_owner_boq_items` ADD COLUMN `sourceTenderBoqItemId` VARCHAR(191) NULL, ADD COLUMN `sourceQuotationLineId` VARCHAR(191) NULL;

CREATE INDEX `contracting_projects_sourceTenderId_idx` ON `contracting_projects`(`sourceTenderId`);
CREATE INDEX `project_owner_boq_items_sourceTenderBoqItemId_idx` ON `project_owner_boq_items`(`sourceTenderBoqItemId`);

ALTER TABLE `contracting_projects` ADD CONSTRAINT `contracting_projects_sourceTenderId_fkey` FOREIGN KEY (`sourceTenderId`) REFERENCES `contract_tenders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `client_contracts` ADD CONSTRAINT `client_contracts_sourceTenderId_fkey` FOREIGN KEY (`sourceTenderId`) REFERENCES `contract_tenders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `client_contracts` ADD CONSTRAINT `client_contracts_sourceQuotationId_fkey` FOREIGN KEY (`sourceQuotationId`) REFERENCES `contract_quotations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `project_owner_boq_items` ADD CONSTRAINT `project_owner_boq_items_sourceTenderBoqItemId_fkey` FOREIGN KEY (`sourceTenderBoqItemId`) REFERENCES `contract_tender_boq_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `project_owner_boq_items` ADD CONSTRAINT `project_owner_boq_items_sourceQuotationLineId_fkey` FOREIGN KEY (`sourceQuotationLineId`) REFERENCES `contract_quotation_lines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
