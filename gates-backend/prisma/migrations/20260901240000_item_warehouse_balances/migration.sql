-- Live warehouse stock balances (Odoo stock_quant analogue).
-- Location-level rows remain on item_quantities; this table is company+item+warehouse.

CREATE TABLE `item_warehouse_balances` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `quantityOnHand` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `reservedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`),
    UNIQUE INDEX `item_warehouse_balances_companyId_itemId_warehouseId_key` (`companyId`, `itemId`, `warehouseId`),
    INDEX `item_warehouse_balances_companyId_idx` (`companyId`),
    INDEX `item_warehouse_balances_itemId_idx` (`itemId`),
    INDEX `item_warehouse_balances_warehouseId_idx` (`warehouseId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `item_warehouse_balances`
    ADD CONSTRAINT `item_warehouse_balances_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `item_warehouse_balances`
    ADD CONSTRAINT `item_warehouse_balances_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `item_warehouse_balances`
    ADD CONSTRAINT `item_warehouse_balances_warehouseId_fkey`
    FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `item_warehouse_balances` (
    `id`,
    `companyId`,
    `itemId`,
    `warehouseId`,
    `quantityOnHand`,
    `reservedQuantity`,
    `updatedAt`
)
SELECT
    UUID(),
    i.`companyId`,
    iq.`itemId`,
    iq.`warehouseId`,
    CAST(SUM(iq.`quantity`) AS DECIMAL(18, 4)),
    0,
    CURRENT_TIMESTAMP(3)
FROM `item_quantities` iq
INNER JOIN `items` i ON i.`id` = iq.`itemId`
GROUP BY i.`companyId`, iq.`itemId`, iq.`warehouseId`;
