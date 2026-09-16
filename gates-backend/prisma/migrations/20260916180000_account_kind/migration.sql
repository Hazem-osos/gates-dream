-- Explicit COA role: HEADER (رئيسي / رئيسي فرعي) vs POSTING (حركة).
-- MySQL cannot UPDATE a table while selecting the same table unless the
-- inner read is wrapped in a derived table.
ALTER TABLE `accounts` ADD COLUMN `accountKind` ENUM('HEADER', 'POSTING') NOT NULL DEFAULT 'POSTING';

UPDATE `accounts`
SET `accountKind` = 'HEADER'
WHERE `deletedAt` IS NULL
  AND `id` IN (
    SELECT `parentId` FROM (
      SELECT DISTINCT `parentId`
      FROM `accounts`
      WHERE `parentId` IS NOT NULL
        AND `deletedAt` IS NULL
    ) AS `header_ids`
  );

UPDATE `accounts`
SET `accountKind` = 'HEADER'
WHERE `deletedAt` IS NULL
  AND `parentId` IS NULL;
