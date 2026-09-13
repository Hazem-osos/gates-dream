ALTER TABLE `companies`
  ADD COLUMN `isOnboarded` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `onboardedAt` DATETIME(3) NULL;

-- Tenants that already have baseline master data are treated as onboarded
UPDATE `companies` c
SET c.`isOnboarded` = true, c.`onboardedAt` = COALESCE(c.`updatedAt`, NOW(3))
WHERE EXISTS (SELECT 1 FROM `branches` b WHERE b.`companyId` = c.`id` AND b.`deletedAt` IS NULL)
  AND EXISTS (SELECT 1 FROM `fiscal_years` fy WHERE fy.`companyId` = c.`id` AND fy.`isActive` = true)
  AND EXISTS (SELECT 1 FROM `safes` s WHERE s.`companyId` = c.`id`)
  AND EXISTS (SELECT 1 FROM `warehouses` w WHERE w.`companyId` = c.`id`)
  AND (SELECT COUNT(*) FROM `accounts` a WHERE a.`companyId` = c.`id` AND a.`deletedAt` IS NULL) >= 5;
