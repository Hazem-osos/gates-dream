-- CreateTable
CREATE TABLE `manufacturing_work_orders` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `orderNumber` VARCHAR(50) NOT NULL,
    `bomId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NULL,
    `workDate` DATE NOT NULL,
    `modelQuantity` DECIMAL(15, 4) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `manufacturing_work_orders_companyId_status_idx`(`companyId`, `status`),
    INDEX `manufacturing_work_orders_companyId_workDate_idx`(`companyId`, `workDate`),
    UNIQUE INDEX `manufacturing_work_orders_companyId_orderNumber_key`(`companyId`, `orderNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manufacturing_work_order_lines` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `plannedQuantity` DECIMAL(15, 4) NOT NULL,
    `completedQuantity` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `unit` VARCHAR(50) NULL,
    `lineOrder` INTEGER NOT NULL DEFAULT 1,

    INDEX `manufacturing_work_order_lines_workOrderId_lineOrder_idx`(`workOrderId`, `lineOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `manufacturing_work_orders` ADD CONSTRAINT `manufacturing_work_orders_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_work_orders` ADD CONSTRAINT `manufacturing_work_orders_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_work_orders` ADD CONSTRAINT `manufacturing_work_orders_bomId_fkey` FOREIGN KEY (`bomId`) REFERENCES `bill_of_materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_work_order_lines` ADD CONSTRAINT `manufacturing_work_order_lines_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `manufacturing_work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manufacturing_work_order_lines` ADD CONSTRAINT `manufacturing_work_order_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
