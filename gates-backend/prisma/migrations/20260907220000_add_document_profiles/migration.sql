-- Document profiles (أنماط ووحدات الإدخال المخصصة)

CREATE TABLE `document_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NULL,
    `baseType` ENUM('SALES_INVOICE', 'PURCHASE_INVOICE', 'PAYMENT_VOUCHER', 'RECEIPT_VOUCHER', 'STOCK_ISSUE', 'STOCK_RECEIPT') NOT NULL,
    `prefix` VARCHAR(191) NULL,
    `nextNumber` INTEGER NOT NULL DEFAULT 1,
    `defaultWarehouseId` VARCHAR(191) NULL,
    `lockWarehouse` BOOLEAN NOT NULL DEFAULT false,
    `defaultTreasuryId` VARCHAR(191) NULL,
    `lockTreasury` BOOLEAN NOT NULL DEFAULT false,
    `defaultCostCenterId` VARCHAR(191) NULL,
    `lockCostCenter` BOOLEAN NOT NULL DEFAULT false,
    `visibleColumns` JSON NOT NULL,
    `showInSidebar` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `document_profiles_companyId_slug_key`(`companyId`, `slug`),
    INDEX `document_profiles_companyId_baseType_idx`(`companyId`, `baseType`),
    INDEX `document_profiles_companyId_showInSidebar_isActive_idx`(`companyId`, `showInSidebar`, `isActive`),
    INDEX `document_profiles_defaultWarehouseId_idx`(`defaultWarehouseId`),
    INDEX `document_profiles_defaultTreasuryId_idx`(`defaultTreasuryId`),
    INDEX `document_profiles_defaultCostCenterId_idx`(`defaultCostCenterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `document_profiles`
  ADD CONSTRAINT `document_profiles_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `document_profiles_defaultWarehouseId_fkey`
    FOREIGN KEY (`defaultWarehouseId`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `document_profiles_defaultTreasuryId_fkey`
    FOREIGN KEY (`defaultTreasuryId`) REFERENCES `safes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `document_profiles_defaultCostCenterId_fkey`
    FOREIGN KEY (`defaultCostCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `invoices` ADD COLUMN `documentProfileId` VARCHAR(191) NULL;
CREATE INDEX `invoices_documentProfileId_idx` ON `invoices`(`documentProfileId`);
ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_documentProfileId_fkey`
    FOREIGN KEY (`documentProfileId`) REFERENCES `document_profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
