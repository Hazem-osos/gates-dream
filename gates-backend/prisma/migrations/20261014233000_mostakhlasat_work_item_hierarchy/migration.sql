-- Hierarchical BOQ / work items (parent 1, child 1.1) and extract cumulative quantities.
-- Additive and backward compatible: existing rows stay executable leaves with previousQuantity = 0.

ALTER TABLE `project_owner_boq_items`
  ADD COLUMN `parentId` VARCHAR(191) NULL,
  ADD COLUMN `isExecutable` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN `notes` TEXT NULL;

ALTER TABLE `project_owner_boq_items`
  ADD INDEX `project_owner_boq_items_parentId_idx` (`parentId`);

ALTER TABLE `project_owner_boq_items`
  ADD CONSTRAINT `project_owner_boq_items_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `project_owner_boq_items`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `project_work_items`
  ADD COLUMN `parentId` VARCHAR(191) NULL,
  ADD COLUMN `isExecutable` BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE `project_work_items`
  ADD INDEX `project_work_items_parentId_idx` (`parentId`);

ALTER TABLE `project_work_items`
  ADD INDEX `project_work_items_projectId_itemNumber_idx` (`projectId`, `itemNumber`);

ALTER TABLE `project_work_items`
  ADD CONSTRAINT `project_work_items_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `project_work_items`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `extract_items`
  ADD COLUMN `previousQuantity` DECIMAL(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `cumulativeQuantity` DECIMAL(15, 4) NOT NULL DEFAULT 0;

UPDATE `extract_items`
SET `cumulativeQuantity` = `quantity`
WHERE `cumulativeQuantity` = 0 AND `quantity` <> 0;

-- Compatibility: existing dotted codes (1 / 1.1) become parent/child rows.
UPDATE `project_owner_boq_items` AS child
INNER JOIN `project_owner_boq_items` AS parent
  ON parent.`companyId` = child.`companyId`
 AND parent.`projectId` = child.`projectId`
 AND parent.`itemCode` = LEFT(
   child.`itemCode`,
   CHAR_LENGTH(child.`itemCode`) - CHAR_LENGTH(SUBSTRING_INDEX(child.`itemCode`, '.', -1)) - 1
 )
 AND child.`itemCode` LIKE '%.%'
 AND child.`id` <> parent.`id`
SET child.`parentId` = parent.`id`
WHERE child.`parentId` IS NULL;

UPDATE `project_owner_boq_items` AS parent
INNER JOIN (
  SELECT DISTINCT `parentId` AS `id`
  FROM `project_owner_boq_items`
  WHERE `parentId` IS NOT NULL
) AS kids ON kids.`id` = parent.`id`
SET parent.`isExecutable` = FALSE;

UPDATE `project_work_items` AS child
INNER JOIN `project_work_items` AS parent
  ON parent.`projectId` = child.`projectId`
 AND parent.`itemNumber` = LEFT(
   child.`itemNumber`,
   CHAR_LENGTH(child.`itemNumber`) - CHAR_LENGTH(SUBSTRING_INDEX(child.`itemNumber`, '.', -1)) - 1
 )
 AND child.`itemNumber` LIKE '%.%'
 AND child.`id` <> parent.`id`
SET child.`parentId` = parent.`id`
WHERE child.`parentId` IS NULL;

UPDATE `project_work_items` AS parent
INNER JOIN (
  SELECT DISTINCT `parentId` AS `id`
  FROM `project_work_items`
  WHERE `parentId` IS NOT NULL
) AS kids ON kids.`id` = parent.`id`
SET parent.`isExecutable` = FALSE;
