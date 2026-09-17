-- Flat leaf roots stay POSTING (مركز حركة). Only roots that already have
-- children remain HEADER. New creates without a parent are still HEADER.
UPDATE `cost_centers`
SET `costCenterKind` = 'POSTING'
WHERE `parentId` IS NULL
  AND `id` NOT IN (
    SELECT `parentId` FROM (
      SELECT DISTINCT `parentId`
      FROM `cost_centers`
      WHERE `parentId` IS NOT NULL
    ) AS `header_ids`
  );
