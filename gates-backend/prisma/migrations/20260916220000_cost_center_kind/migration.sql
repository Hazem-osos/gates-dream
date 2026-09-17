-- Explicit cost-center role: HEADER (رئيسي / رئيسي فرعي) vs POSTING (مركز حركة).
-- MySQL cannot UPDATE a table while selecting the same table unless the
-- inner read is wrapped in a derived table.
ALTER TABLE `cost_centers` ADD COLUMN `costCenterKind` ENUM('HEADER', 'POSTING') NOT NULL DEFAULT 'POSTING';

UPDATE `cost_centers`
SET `costCenterKind` = 'HEADER'
WHERE `id` IN (
  SELECT `parentId` FROM (
    SELECT DISTINCT `parentId`
    FROM `cost_centers`
    WHERE `parentId` IS NOT NULL
  ) AS `header_ids`
);

UPDATE `cost_centers`
SET `costCenterKind` = 'HEADER'
WHERE `parentId` IS NULL;

CREATE INDEX `cost_centers_companyId_costCenterKind_idx` ON `cost_centers`(`companyId`, `costCenterKind`);
