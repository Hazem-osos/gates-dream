CREATE TABLE `item_order_limit_lists` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NULL,
  `warehouseId` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `item_order_limit_lists_companyId_code_key` (`companyId`, `code`),
  INDEX `item_order_limit_lists_companyId_idx` (`companyId`),
  INDEX `item_order_limit_lists_warehouseId_idx` (`warehouseId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `item_order_limit_lines` (
  `id` VARCHAR(191) NOT NULL,
  `listId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `orderLimit` DECIMAL(15, 3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `item_order_limit_lines_listId_itemId_key` (`listId`, `itemId`),
  INDEX `item_order_limit_lines_itemId_idx` (`itemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `item_order_limit_lists`
  ADD CONSTRAINT `item_order_limit_lists_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `item_order_limit_lists_warehouseId_fkey`
    FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `item_order_limit_lines`
  ADD CONSTRAINT `item_order_limit_lines_listId_fkey`
    FOREIGN KEY (`listId`) REFERENCES `item_order_limit_lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `item_order_limit_lines_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
