-- CreateTable
CREATE TABLE `new_modules` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `baseType` CHAR(2) NOT NULL,
    `moduleCode` CHAR(2) NOT NULL,
    `fullCode` VARCHAR(4) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NULL,
    `menuNameAr` VARCHAR(191) NOT NULL,
    `menuNameEn` VARCHAR(191) NULL,
    `priceListId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `new_modules_companyId_baseType_idx`(`companyId`, `baseType`),
    UNIQUE INDEX `new_modules_companyId_baseType_moduleCode_key`(`companyId`, `baseType`, `moduleCode`),
    UNIQUE INDEX `new_modules_companyId_fullCode_key`(`companyId`, `fullCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `new_module_stores` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `newModuleId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `new_module_stores_companyId_idx`(`companyId`),
    UNIQUE INDEX `new_module_stores_newModuleId_warehouseId_key`(`newModuleId`, `warehouseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `other_module_rights` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `sanadModule` VARCHAR(4) NOT NULL,
    `readModule` VARCHAR(4) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `other_module_rights_companyId_idx`(`companyId`),
    UNIQUE INDEX `other_module_rights_companyId_sanadModule_readModule_key`(`companyId`, `sanadModule`, `readModule`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `new_modules` ADD CONSTRAINT `new_modules_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `new_modules` ADD CONSTRAINT `new_modules_priceListId_fkey` FOREIGN KEY (`priceListId`) REFERENCES `price_lists`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `new_module_stores` ADD CONSTRAINT `new_module_stores_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `new_module_stores` ADD CONSTRAINT `new_module_stores_newModuleId_fkey` FOREIGN KEY (`newModuleId`) REFERENCES `new_modules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `new_module_stores` ADD CONSTRAINT `new_module_stores_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `other_module_rights` ADD CONSTRAINT `other_module_rights_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

