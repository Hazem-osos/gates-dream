-- Inventory costing engine: global + warehouse MAC, movement snapshots.

ALTER TABLE `items`
  ADD COLUMN `averageCost` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `lastPurchasePrice` DECIMAL(18, 4) NOT NULL DEFAULT 0;

ALTER TABLE `item_warehouse_balances`
  ADD COLUMN `averageCost` DECIMAL(18, 4) NOT NULL DEFAULT 0;

ALTER TABLE `inventory_movements`
  ADD COLUMN `resultingAverageCost` DECIMAL(18, 4) NULL,
  ADD COLUMN `sourceDocumentId` VARCHAR(80) NULL;

CREATE INDEX `inventory_movements_companyId_sourceDocumentId_idx`
  ON `inventory_movements`(`companyId`, `sourceDocumentId`);

-- Seed Item.averageCost from the latest cost-history serial per item.
UPDATE `items` i
INNER JOIN (
  SELECT h.itemId, h.cost
  FROM `item_cost_history` h
  INNER JOIN (
    SELECT itemId, MAX(serial) AS maxSerial
    FROM `item_cost_history`
    GROUP BY itemId
  ) latest ON latest.itemId = h.itemId AND latest.maxSerial = h.serial
) src ON src.itemId = i.id
SET i.averageCost = src.cost;
