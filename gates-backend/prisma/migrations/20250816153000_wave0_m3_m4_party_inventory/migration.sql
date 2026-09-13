-- Wave 0 M3/M4: Party masters extensions + inventory costing ledger
-- Dialect: MySQL 8+ (Prisma Migrate). Do not run on SQL Server.

-- CreateTable (before FK columns on customers)
CREATE TABLE `customer_categories` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `legacyCode` VARCHAR(30) NOT NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `customer_categories_companyId_idx`(`companyId`),
    UNIQUE INDEX `customer_categories_companyId_legacyCode_key`(`companyId`, `legacyCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `customers` ADD COLUMN `creditLimit` DECIMAL(18, 4) NULL,
    ADD COLUMN `customerCategoryId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `suppliers` ADD COLUMN `creditLimit` DECIMAL(18, 4) NULL;

-- AlterTable
ALTER TABLE `warehouses` ADD COLUMN `legacyStoreCode` VARCHAR(20) NULL;

-- CreateTable
CREATE TABLE `person_groups` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `legacyCode` VARCHAR(30) NOT NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `person_groups_companyId_legacyCode_key`(`companyId`, `legacyCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `persons` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `legacyCode` VARCHAR(30) NOT NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `personGroupId` VARCHAR(191) NULL,
    `mainAccountId` VARCHAR(191) NULL,
    `priceListId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `persons_companyId_personGroupId_idx`(`companyId`, `personGroupId`),
    UNIQUE INDEX `persons_companyId_legacyCode_key`(`companyId`, `legacyCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `person_item_prices` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `personId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NULL,
    `price` DECIMAL(18, 4) NOT NULL,
    `discountPct` DECIMAL(18, 4) NULL,
    `validFrom` DATETIME(3) NULL,
    `validTo` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `person_item_prices_companyId_personId_itemId_idx`(`companyId`, `personId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_cost_history` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `serial` INTEGER NOT NULL,
    `cost` DECIMAL(18, 4) NOT NULL,
    `effectiveAt` DATETIME(3) NOT NULL,
    `documentDate` DATETIME(3) NOT NULL,
    `hijriDate` VARCHAR(191) NULL,
    `sourceType` VARCHAR(30) NOT NULL,
    `sourceNumber` VARCHAR(30) NOT NULL,
    `sourceYearId` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `item_cost_history_companyId_itemId_effectiveAt_idx`(`companyId`, `itemId`, `effectiveAt`),
    UNIQUE INDEX `item_cost_history_companyId_itemId_serial_key`(`companyId`, `itemId`, `serial`),
    UNIQUE INDEX `item_cost_history_companyId_itemId_sourceType_sourceNumber_s_key`(`companyId`, `itemId`, `sourceType`, `sourceNumber`, `sourceYearId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_movements` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `quantityDelta` DECIMAL(18, 4) NOT NULL,
    `unitCost` DECIMAL(18, 4) NULL,
    `movementType` VARCHAR(30) NOT NULL,
    `sourceType` VARCHAR(30) NULL,
    `sourceNumber` VARCHAR(30) NULL,
    `sourceYearId` VARCHAR(20) NULL,
    `documentDate` DATETIME(3) NOT NULL,
    `effectiveAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inventory_movements_companyId_itemId_effectiveAt_idx`(`companyId`, `itemId`, `effectiveAt`),
    INDEX `inventory_movements_companyId_warehouseId_itemId_idx`(`companyId`, `warehouseId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `customers_customerCategoryId_idx` ON `customers`(`customerCategoryId`);

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_customerCategoryId_fkey` FOREIGN KEY (`customerCategoryId`) REFERENCES `customer_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_categories` ADD CONSTRAINT `customer_categories_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `person_groups` ADD CONSTRAINT `person_groups_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `persons` ADD CONSTRAINT `persons_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `persons` ADD CONSTRAINT `persons_personGroupId_fkey` FOREIGN KEY (`personGroupId`) REFERENCES `person_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `persons` ADD CONSTRAINT `persons_mainAccountId_fkey` FOREIGN KEY (`mainAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `person_item_prices` ADD CONSTRAINT `person_item_prices_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `person_item_prices` ADD CONSTRAINT `person_item_prices_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `persons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `person_item_prices` ADD CONSTRAINT `person_item_prices_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `person_item_prices` ADD CONSTRAINT `person_item_prices_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_cost_history` ADD CONSTRAINT `item_cost_history_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_cost_history` ADD CONSTRAINT `item_cost_history_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_cost_history` ADD CONSTRAINT `item_cost_history_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
