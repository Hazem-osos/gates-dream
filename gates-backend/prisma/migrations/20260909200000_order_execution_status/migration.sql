-- Administrative fulfillment for cash orders (أمر صرف / أمر توريد).
-- Does not touch the GL posting pipeline.

ALTER TABLE `cash_transactions`
  ADD COLUMN `executionStatus` ENUM('PENDING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `executedAt` DATETIME(3) NULL,
  ADD COLUMN `executedBy` VARCHAR(191) NULL,
  ADD COLUMN `createdBy` VARCHAR(191) NULL;

CREATE INDEX `cash_transactions_companyId_documentRole_executionStatus_idx`
  ON `cash_transactions`(`companyId`, `documentRole`, `executionStatus`);

UPDATE `cash_transactions`
  SET `executionStatus` = 'CANCELLED'
  WHERE `isCancelled` = true;

UPDATE `cash_transactions`
  SET `executionStatus` = 'COMPLETED'
  WHERE `documentRole` = 'ORDER'
    AND `isCancelled` = false
    AND `isPosted` = true;

UPDATE `cash_transactions` `ct`
  INNER JOIN (
    SELECT DISTINCT `sourceOrderId` AS `oid`
    FROM `cash_transactions`
    WHERE `sourceOrderId` IS NOT NULL
  ) `v` ON `v`.`oid` = `ct`.`id`
  SET `ct`.`executionStatus` = 'COMPLETED'
  WHERE `ct`.`documentRole` = 'ORDER'
    AND `ct`.`isCancelled` = false;
