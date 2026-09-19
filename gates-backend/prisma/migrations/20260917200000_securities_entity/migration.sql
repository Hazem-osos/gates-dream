CREATE TABLE `securities_entities` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `securities_entities_companyId_arabicName_key`(`companyId`, `arabicName`),
    INDEX `securities_entities_companyId_isActive_idx`(`companyId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `securities_entities`
  ADD CONSTRAINT `securities_entities_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `securities_receipts` ADD COLUMN `entityId` VARCHAR(191) NULL;
ALTER TABLE `securities_payments` ADD COLUMN `entityId` VARCHAR(191) NULL;

INSERT IGNORE INTO `securities_entities` (`id`, `companyId`, `arabicName`, `isActive`, `createdAt`, `updatedAt`)
SELECT UUID(), `companyId`, `arabicName`, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (
  SELECT DISTINCT `companyId`, TRIM(`entityName`) AS `arabicName`
  FROM (
    SELECT `companyId`, `entityName` FROM `securities_receipts`
    WHERE `entityName` IS NOT NULL AND TRIM(`entityName`) <> ''
    UNION
    SELECT `companyId`, `entityName` FROM `securities_payments`
    WHERE `entityName` IS NOT NULL AND TRIM(`entityName`) <> ''
  ) names
) distinct_names;

UPDATE `securities_receipts` r
INNER JOIN `securities_entities` e
  ON e.`companyId` = r.`companyId` AND e.`arabicName` = TRIM(r.`entityName`)
SET r.`entityId` = e.`id`
WHERE r.`entityName` IS NOT NULL AND TRIM(r.`entityName`) <> '';

UPDATE `securities_payments` p
INNER JOIN `securities_entities` e
  ON e.`companyId` = p.`companyId` AND e.`arabicName` = TRIM(p.`entityName`)
SET p.`entityId` = e.`id`
WHERE p.`entityName` IS NOT NULL AND TRIM(p.`entityName`) <> '';

ALTER TABLE `securities_receipts`
  ADD INDEX `securities_receipts_entityId_idx`(`entityId`),
  ADD CONSTRAINT `securities_receipts_entityId_fkey`
  FOREIGN KEY (`entityId`) REFERENCES `securities_entities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `securities_payments`
  ADD INDEX `securities_payments_entityId_idx`(`entityId`),
  ADD CONSTRAINT `securities_payments_entityId_fkey`
  FOREIGN KEY (`entityId`) REFERENCES `securities_entities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
