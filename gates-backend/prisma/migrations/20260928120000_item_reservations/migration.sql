-- Manual item holds. Reserved quantity is a cache on item_warehouse_balances;
-- this table is the document behind that cache. On-hand stock is not changed.
CREATE TABLE `item_reservations` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(18, 4) NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  `releasedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `item_reservations_companyId_warehouseId_idx` (`companyId`, `warehouseId`),
  INDEX `item_reservations_itemId_idx` (`itemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `item_reservations`
  ADD CONSTRAINT `item_reservations_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `item_reservations_warehouseId_fkey`
    FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `item_reservations_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
