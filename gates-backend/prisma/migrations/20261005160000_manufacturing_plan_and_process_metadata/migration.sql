-- Manufacturing plans + production order process metadata / unified costing JE link

ALTER TABLE `production_orders`
  ADD COLUMN `additionalCostsJournalEntryId` VARCHAR(191) NULL,
  ADD COLUMN `processMetadata` JSON NULL;

CREATE TABLE `manufacturing_plans` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `planNumber` VARCHAR(50) NOT NULL,
  `description` VARCHAR(500) NULL,
  `headerBomId` VARCHAR(191) NULL,
  `headerStage` VARCHAR(100) NULL,
  `fromWarehouseId` VARCHAR(191) NULL,
  `costCenter` VARCHAR(100) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `manufacturing_plans_companyId_planNumber_key`(`companyId`, `planNumber`),
  INDEX `manufacturing_plans_companyId_updatedAt_idx`(`companyId`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `manufacturing_plan_lines` (
  `id` VARCHAR(191) NOT NULL,
  `planId` VARCHAR(191) NOT NULL,
  `lineNo` INTEGER NOT NULL,
  `lineDate` DATE NOT NULL,
  `bomId` VARCHAR(191) NOT NULL,
  `stage` VARCHAR(100) NULL,
  `quantity` DECIMAL(15, 4) NOT NULL,
  `warehouseId` VARCHAR(191) NULL,
  `costCenter` VARCHAR(100) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `manufacturing_plan_lines_planId_lineNo_idx`(`planId`, `lineNo`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `manufacturing_plans`
  ADD CONSTRAINT `manufacturing_plans_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `manufacturing_plans_fromWarehouseId_fkey`
    FOREIGN KEY (`fromWarehouseId`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `manufacturing_plan_lines`
  ADD CONSTRAINT `manufacturing_plan_lines_planId_fkey`
    FOREIGN KEY (`planId`) REFERENCES `manufacturing_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `manufacturing_plan_lines_bomId_fkey`
    FOREIGN KEY (`bomId`) REFERENCES `bill_of_materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `manufacturing_plan_lines_warehouseId_fkey`
    FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
