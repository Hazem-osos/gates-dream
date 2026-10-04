-- P2-1 Actual project cost allocations + issue line project tagging

ALTER TABLE `issue_lines`
  ADD COLUMN `contractingProjectId` VARCHAR(191) NULL,
  ADD COLUMN `projectBOQItemId` VARCHAR(191) NULL;

CREATE INDEX `issue_lines_contractingProjectId_idx` ON `issue_lines`(`contractingProjectId`);
CREATE INDEX `issue_lines_projectBOQItemId_idx` ON `issue_lines`(`projectBOQItemId`);

ALTER TABLE `issue_lines`
  ADD CONSTRAINT `issue_lines_contractingProjectId_fkey`
    FOREIGN KEY (`contractingProjectId`) REFERENCES `contracting_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `issue_lines_projectBOQItemId_fkey`
    FOREIGN KEY (`projectBOQItemId`) REFERENCES `project_owner_boq_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `project_cost_allocations` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `projectBOQItemId` VARCHAR(191) NULL,
  `costCategory` ENUM('MATERIAL', 'LABOR', 'SUBCONTRACTOR', 'EQUIPMENT', 'DIRECT_EXPENSE', 'PURCHASE', 'OVERHEAD', 'OTHER') NOT NULL,
  `sourceType` ENUM('INVENTORY_ISSUE_LINE', 'SUBCONTRACT_INVOICE_ITEM', 'CASH_TRANSACTION_LINE', 'JOURNAL_ENTRY_LINE', 'MANUAL_COST_SPLIT') NOT NULL,
  `sourceId` VARCHAR(191) NOT NULL,
  `sourceLineId` VARCHAR(191) NULL,
  `allocationKey` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(18, 4) NULL,
  `amountBase` DECIMAL(18, 4) NOT NULL,
  `sourceCurrencyCode` VARCHAR(8) NULL,
  `exchangeRate` DECIMAL(18, 6) NULL,
  `transactionDate` DATETIME(3) NOT NULL,
  `status` ENUM('ACTIVE', 'REVERSED') NOT NULL DEFAULT 'ACTIVE',
  `description` TEXT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `pc_alloc_company_key_uq`(`companyId`, `allocationKey`),
  INDEX `project_cost_allocations_companyId_projectId_idx`(`companyId`, `projectId`),
  INDEX `project_cost_allocations_companyId_projectBOQItemId_idx`(`companyId`, `projectBOQItemId`),
  INDEX `project_cost_allocations_companyId_sourceType_sourceId_idx`(`companyId`, `sourceType`, `sourceId`),
  INDEX `project_cost_allocations_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `project_cost_allocations`
  ADD CONSTRAINT `project_cost_allocations_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `project_cost_allocations_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `contracting_projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `project_cost_allocations_projectBOQItemId_fkey`
    FOREIGN KEY (`projectBOQItemId`) REFERENCES `project_owner_boq_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
