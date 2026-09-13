-- Default warehouse + whether prices come from price lists or the item card.

ALTER TABLE `items`
  ADD COLUMN `defaultWarehouseId` VARCHAR(191) NULL,
  ADD COLUMN `priceSource` VARCHAR(191) NULL;

CREATE INDEX `items_defaultWarehouseId_idx` ON `items`(`defaultWarehouseId`);
