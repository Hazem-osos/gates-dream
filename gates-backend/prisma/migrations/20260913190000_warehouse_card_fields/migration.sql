-- Warehouse card fields from legacy بطاقة مخزن.

ALTER TABLE `warehouses`
  ADD COLUMN `storeType` VARCHAR(20) NULL,
  ADD COLUMN `parentWarehouseId` VARCHAR(191) NULL,
  ADD COLUMN `inventoryAccountId` VARCHAR(191) NULL,
  ADD COLUMN `costAccountId` VARCHAR(191) NULL,
  ADD COLUMN `giftAccountId` VARCHAR(191) NULL,
  ADD COLUMN `address` VARCHAR(255) NULL,
  ADD COLUMN `keeperName` VARCHAR(191) NULL;

CREATE INDEX `warehouses_parentWarehouseId_idx` ON `warehouses`(`parentWarehouseId`);
CREATE INDEX `warehouses_inventoryAccountId_idx` ON `warehouses`(`inventoryAccountId`);
CREATE INDEX `warehouses_costAccountId_idx` ON `warehouses`(`costAccountId`);
CREATE INDEX `warehouses_giftAccountId_idx` ON `warehouses`(`giftAccountId`);

ALTER TABLE `warehouses`
  ADD CONSTRAINT `warehouses_parentWarehouseId_fkey`
    FOREIGN KEY (`parentWarehouseId`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `warehouses_inventoryAccountId_fkey`
    FOREIGN KEY (`inventoryAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `warehouses_costAccountId_fkey`
    FOREIGN KEY (`costAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `warehouses_giftAccountId_fkey`
    FOREIGN KEY (`giftAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
