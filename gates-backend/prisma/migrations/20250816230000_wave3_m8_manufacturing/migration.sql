-- Wave 3 M8: Manufacturing BOM & production orders
-- MySQL 8

CREATE TABLE `manufacturing_settings` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `wipMaterialsAccountCode` VARCHAR(20) NULL,
  `wipLaborOverheadAccountCode` VARCHAR(20) NULL,
  `rawInventoryAccountCode` VARCHAR(20) NULL,
  `finishedGoodsAccountCode` VARCHAR(20) NULL,
  `overheadAbsorptionAccountCode` VARCHAR(20) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `manufacturing_settings_companyId_key` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bill_of_materials` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `finishedItemId` VARCHAR(191) NOT NULL,
  `baseQuantity` DECIMAL(15, 4) NOT NULL DEFAULT 1,
  `standardLaborCost` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `standardOverheadCost` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `bill_of_materials_companyId_finishedItemId_idx` (`companyId`, `finishedItemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bom_lines` (
  `id` VARCHAR(191) NOT NULL,
  `bomId` VARCHAR(191) NOT NULL,
  `rawItemId` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(15, 4) NOT NULL,
  `scrapPercentage` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  `lineOrder` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `bom_lines_bomId_idx` (`bomId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `production_orders` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `fiscalYearId` VARCHAR(191) NULL,
  `sourceYearId` VARCHAR(20) NULL,
  `orderNumber` VARCHAR(191) NOT NULL,
  `bomId` VARCHAR(191) NOT NULL,
  `finishedItemId` VARCHAR(191) NOT NULL,
  `plannedQuantity` DECIMAL(15, 4) NOT NULL,
  `actualQuantity` DECIMAL(15, 4) NULL,
  `warehouseIdRaw` VARCHAR(191) NOT NULL,
  `warehouseIdFinished` VARCHAR(191) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `totalMaterialCost` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalLaborCost` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalOverheadCost` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `unitCost` DECIMAL(15, 4) NULL,
  `materialsIssueJournalEntryId` VARCHAR(191) NULL,
  `laborOverheadJournalEntryId` VARCHAR(191) NULL,
  `completionJournalEntryId` VARCHAR(191) NULL,
  `releasedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `production_orders_companyId_orderNumber_key` (`companyId`, `orderNumber`),
  INDEX `production_orders_companyId_status_idx` (`companyId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `production_material_issues` (
  `id` VARCHAR(191) NOT NULL,
  `productionOrderId` VARCHAR(191) NOT NULL,
  `issueDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `journalEntryId` VARCHAR(191) NULL,
  `totalCost` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `production_material_issues_productionOrderId_idx` (`productionOrderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `production_material_issue_lines` (
  `id` VARCHAR(191) NOT NULL,
  `materialIssueId` VARCHAR(191) NOT NULL,
  `rawItemId` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(15, 4) NOT NULL,
  `unitCost` DECIMAL(15, 4) NOT NULL,
  `totalCost` DECIMAL(15, 2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `production_material_issue_lines_materialIssueId_idx` (`materialIssueId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
