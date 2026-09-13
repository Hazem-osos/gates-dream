-- Transaction settings engine (إعدادات الفاتورة وسياسات الحركات)

CREATE TABLE `transaction_settings` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('SALES_INVOICE', 'PURCHASE_INVOICE', 'PAYMENT_VOUCHER', 'RECEIPT_VOUCHER', 'STOCK_ISSUE', 'STOCK_RECEIPT') NOT NULL DEFAULT 'SALES_INVOICE',
    `numberingMode` ENUM('AUTOMATIC', 'MANUAL') NOT NULL DEFAULT 'AUTOMATIC',
    `sequenceMode` ENUM('CONTINUOUS', 'ANNUAL_RESET') NOT NULL DEFAULT 'CONTINUOUS',
    `autoPostOnSave` BOOLEAN NOT NULL DEFAULT false,
    `autoPrintOnSave` BOOLEAN NOT NULL DEFAULT false,
    `generateEntryOnSave` BOOLEAN NOT NULL DEFAULT true,
    `affectStock` BOOLEAN NOT NULL DEFAULT true,
    `allowItemPriceOverride` BOOLEAN NOT NULL DEFAULT true,
    `preventSellingBelowCost` BOOLEAN NOT NULL DEFAULT true,
    `preventNegativeStock` BOOLEAN NOT NULL DEFAULT true,
    `autoApplyVat` BOOLEAN NOT NULL DEFAULT true,
    `autoApplyWht` BOOLEAN NOT NULL DEFAULT false,
    `autoApplyDevelopmentTax` BOOLEAN NOT NULL DEFAULT false,
    `cascadingDiscounts` BOOLEAN NOT NULL DEFAULT false,
    `showAllAccountsInCustomerField` BOOLEAN NOT NULL DEFAULT false,
    `defaultSalesAccountId` VARCHAR(191) NULL,
    `defaultCostCenterId` VARCHAR(191) NULL,
    `defaultWarehouseId` VARCHAR(191) NULL,
    `pricingPolicy` ENUM('COST', 'LAST_PURCHASE', 'LAST_SALE', 'LAST_SALE_TO_CUSTOMER') NOT NULL DEFAULT 'LAST_SALE',
    `costCenterSide` ENUM('DEBIT', 'CREDIT') NOT NULL DEFAULT 'DEBIT',
    `costCenterAllocationTarget` ENUM('SALES', 'COST_OF_GOODS_SOLD') NOT NULL DEFAULT 'SALES',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `transaction_settings_companyId_documentType_key`(`companyId`, `documentType`),
    INDEX `transaction_settings_defaultSalesAccountId_idx`(`defaultSalesAccountId`),
    INDEX `transaction_settings_defaultCostCenterId_idx`(`defaultCostCenterId`),
    INDEX `transaction_settings_defaultWarehouseId_idx`(`defaultWarehouseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `transaction_settings`
  ADD CONSTRAINT `transaction_settings_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `transaction_settings_defaultSalesAccountId_fkey`
    FOREIGN KEY (`defaultSalesAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `transaction_settings_defaultCostCenterId_fkey`
    FOREIGN KEY (`defaultCostCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `transaction_settings_defaultWarehouseId_fkey`
    FOREIGN KEY (`defaultWarehouseId`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
