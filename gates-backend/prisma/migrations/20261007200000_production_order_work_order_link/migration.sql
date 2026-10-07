-- Drop mistaken WO → PO link (correct direction is PO → WO)
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'manufacturing_work_orders'
    AND CONSTRAINT_NAME = 'manufacturing_work_orders_productionOrderId_fkey'
);
SET @sql = IF(@fk_exists > 0,
  'ALTER TABLE `manufacturing_work_orders` DROP FOREIGN KEY `manufacturing_work_orders_productionOrderId_fkey`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'manufacturing_work_orders'
    AND COLUMN_NAME = 'productionOrderId'
);
SET @sql2 = IF(@col_exists > 0,
  'ALTER TABLE `manufacturing_work_orders` DROP COLUMN `productionOrderId`',
  'SELECT 1');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

ALTER TABLE `production_orders`
  ADD COLUMN `manufacturingWorkOrderId` VARCHAR(191) NULL;

CREATE INDEX `production_orders_companyId_manufacturingWorkOrderId_idx`
  ON `production_orders`(`companyId`, `manufacturingWorkOrderId`);

ALTER TABLE `production_orders`
  ADD CONSTRAINT `production_orders_manufacturingWorkOrderId_fkey`
  FOREIGN KEY (`manufacturingWorkOrderId`) REFERENCES `manufacturing_work_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
