-- Idempotent completion for partial apply of 20261004230000_contract_variation_orders

SET @db := DATABASE();

-- project_owner_boq_items.origin
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'project_owner_boq_items' AND COLUMN_NAME = 'origin') = 0,
    'ALTER TABLE `project_owner_boq_items` ADD COLUMN `origin` ENUM(''BASE_CONTRACT'', ''VARIATION_ORDER'') NOT NULL DEFAULT ''BASE_CONTRACT'', ADD COLUMN `sourceVariationOrderId` VARCHAR(191) NULL, ADD INDEX `project_owner_boq_items_sourceVariationOrderId_idx` (`sourceVariationOrderId`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subcontract_boq_items.origin
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'subcontract_boq_items' AND COLUMN_NAME = 'origin') = 0,
    'ALTER TABLE `subcontract_boq_items` ADD COLUMN `origin` ENUM(''BASE_CONTRACT'', ''VARIATION_ORDER'') NOT NULL DEFAULT ''BASE_CONTRACT'', ADD COLUMN `sourceVariationOrderId` VARCHAR(191) NULL, ADD INDEX `subcontract_boq_items_sourceVariationOrderId_idx` (`sourceVariationOrderId`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `contract_variation_orders` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `clientContractId` VARCHAR(191) NOT NULL,
  `orderNumber` VARCHAR(191) NOT NULL,
  `sequenceNumber` INT NOT NULL,
  `orderDate` DATETIME(3) NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `increaseValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `decreaseValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `netImpact` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `originalContractValueSnapshot` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `revisedContractValueSnapshot` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `createdBy` VARCHAR(191) NULL,
  `submittedAt` DATETIME(3) NULL,
  `submittedBy` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectedBy` VARCHAR(191) NULL,
  `rejectionReason` TEXT NULL,
  `cancelledAt` DATETIME(3) NULL,
  `cancelledBy` VARCHAR(191) NULL,
  `cancellationReason` TEXT NULL,
  `reversesVariationOrderId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `contract_variation_orders_companyId_orderNumber_key` (`companyId`, `orderNumber`),
  UNIQUE INDEX `contract_variation_orders_clientContractId_sequenceNumber_key` (`clientContractId`, `sequenceNumber`),
  INDEX `contract_variation_orders_companyId_idx` (`companyId`),
  INDEX `contract_variation_orders_clientContractId_idx` (`clientContractId`),
  INDEX `contract_variation_orders_projectId_idx` (`projectId`),
  INDEX `contract_variation_orders_status_idx` (`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contract_variation_order_lines` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `contractVariationOrderId` VARCHAR(191) NOT NULL,
  `lineOrder` INT NOT NULL DEFAULT 1,
  `changeType` ENUM('QUANTITY_CHANGE', 'RATE_CHANGE', 'NEW_ITEM', 'OMIT') NOT NULL,
  `projectBOQItemId` VARCHAR(191) NULL,
  `itemCodeSnapshot` VARCHAR(191) NOT NULL,
  `descriptionArSnapshot` VARCHAR(191) NOT NULL,
  `unitSnapshot` VARCHAR(20) NOT NULL,
  `originalQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `quantityDelta` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `effectiveQuantityAfter` DECIMAL(18, 4) NULL,
  `originalRate` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `approvedRate` DECIMAL(18, 4) NULL,
  `rateDelta` DECIMAL(18, 4) NULL,
  `amountImpact` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `createdProjectBOQItemId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `cvo_lines_company_idx` (`companyId`),
  INDEX `cvo_lines_order_idx` (`contractVariationOrderId`),
  INDEX `cvo_lines_boq_idx` (`projectBOQItemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subcontract_variation_orders` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `subcontractId` VARCHAR(191) NOT NULL,
  `orderNumber` VARCHAR(191) NOT NULL,
  `sequenceNumber` INT NOT NULL,
  `orderDate` DATETIME(3) NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `increaseValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `decreaseValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `netImpact` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `originalContractValueSnapshot` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `revisedContractValueSnapshot` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `createdBy` VARCHAR(191) NULL,
  `submittedAt` DATETIME(3) NULL,
  `submittedBy` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectedBy` VARCHAR(191) NULL,
  `rejectionReason` TEXT NULL,
  `cancelledAt` DATETIME(3) NULL,
  `cancelledBy` VARCHAR(191) NULL,
  `cancellationReason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `subcontract_variation_orders_companyId_orderNumber_key` (`companyId`, `orderNumber`),
  UNIQUE INDEX `subcontract_variation_orders_subcontractId_sequenceNumber_key` (`subcontractId`, `sequenceNumber`),
  INDEX `svo_company_idx` (`companyId`),
  INDEX `svo_subcontract_idx` (`subcontractId`),
  INDEX `svo_status_idx` (`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subcontract_variation_order_lines` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `subcontractVariationOrderId` VARCHAR(191) NOT NULL,
  `lineOrder` INT NOT NULL DEFAULT 1,
  `changeType` ENUM('QUANTITY_CHANGE', 'RATE_CHANGE', 'NEW_ITEM', 'OMIT') NOT NULL,
  `subcontractBOQItemId` VARCHAR(191) NULL,
  `itemCodeSnapshot` VARCHAR(191) NOT NULL,
  `descriptionArSnapshot` VARCHAR(191) NOT NULL,
  `unitSnapshot` VARCHAR(20) NOT NULL,
  `originalQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `quantityDelta` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `effectiveQuantityAfter` DECIMAL(18, 4) NULL,
  `originalRate` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `approvedRate` DECIMAL(18, 4) NULL,
  `rateDelta` DECIMAL(18, 4) NULL,
  `amountImpact` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `createdSubcontractBOQItemId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `subcontract_variation_order_lines_companyId_idx` (`companyId`),
  INDEX `subcontract_variation_order_lines_subcontractVariationOrderId_idx` (`subcontractVariationOrderId`),
  INDEX `subcontract_variation_order_lines_subcontractBOQItemId_idx` (`subcontractBOQItemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
