-- Explicit warehouse role: HEADER (رئيسي / رئيسي فرعي) vs POSTING (عمليات).
-- MySQL cannot UPDATE a table while selecting the same table unless the
-- inner read is wrapped in a derived table.
ALTER TABLE `warehouses` ADD COLUMN `warehouseKind` ENUM('HEADER', 'POSTING') NOT NULL DEFAULT 'POSTING';

UPDATE `warehouses`
SET `warehouseKind` = 'HEADER'
WHERE `id` IN (
  SELECT `parentWarehouseId` FROM (
    SELECT DISTINCT `parentWarehouseId`
    FROM `warehouses`
    WHERE `parentWarehouseId` IS NOT NULL
  ) AS `header_ids`
);

UPDATE `warehouses`
SET `warehouseKind` = 'HEADER'
WHERE `parentWarehouseId` IS NULL;

CREATE INDEX `warehouses_companyId_warehouseKind_idx` ON `warehouses`(`companyId`, `warehouseKind`);
