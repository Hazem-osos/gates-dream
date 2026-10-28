-- CreateTable
CREATE TABLE `fixed_asset_categories` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `arabicName` VARCHAR(200) NOT NULL,
    `englishName` VARCHAR(200) NULL,
    `parentId` VARCHAR(191) NULL,
    `depreciationMethod` ENUM('STRAIGHT_LINE', 'DECLINING_BALANCE', 'NONE') NOT NULL DEFAULT 'STRAIGHT_LINE',
    `usefulLifeMonths` INTEGER NULL,
    `decliningRate` DECIMAL(9, 4) NULL,
    `salvagePercent` DECIMAL(9, 4) NOT NULL DEFAULT 0,
    `assetAccountId` VARCHAR(191) NULL,
    `accumulatedDepreciationAccountId` VARCHAR(191) NULL,
    `depreciationExpenseAccountId` VARCHAR(191) NULL,
    `disposalGainAccountId` VARCHAR(191) NULL,
    `disposalLossAccountId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `fixed_asset_categories_companyId_parentId_idx`(`companyId`, `parentId`),
    UNIQUE INDEX `fixed_asset_categories_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fixed_assets` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `arabicName` VARCHAR(200) NOT NULL,
    `englishName` VARCHAR(200) NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'FULLY_DEPRECIATED', 'DISPOSED') NOT NULL DEFAULT 'DRAFT',
    `acquisitionType` ENUM('PURCHASE', 'EXISTING') NOT NULL DEFAULT 'PURCHASE',
    `acquisitionDate` DATE NOT NULL,
    `inServiceDate` DATE NOT NULL,
    `cost` DECIMAL(18, 4) NOT NULL,
    `vatAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `salvageValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `usefulLifeMonths` INTEGER NOT NULL,
    `depreciationMethod` ENUM('STRAIGHT_LINE', 'DECLINING_BALANCE', 'NONE') NOT NULL DEFAULT 'STRAIGHT_LINE',
    `decliningRate` DECIMAL(9, 4) NULL,
    `openingAccumulatedDepreciation` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `openingDepreciatedThrough` DATE NULL,
    `accumulatedDepreciation` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `depreciatedThrough` DATE NULL,
    `assetAccountId` VARCHAR(191) NOT NULL,
    `accumulatedDepreciationAccountId` VARCHAR(191) NOT NULL,
    `depreciationExpenseAccountId` VARCHAR(191) NOT NULL,
    `creditAccountId` VARCHAR(191) NULL,
    `supplierId` VARCHAR(191) NULL,
    `journalEntryId` VARCHAR(191) NULL,
    `branchId` VARCHAR(191) NULL,
    `costCenterId` VARCHAR(191) NULL,
    `custodianEmployeeId` VARCHAR(191) NULL,
    `location` VARCHAR(200) NULL,
    `serialNumber` VARCHAR(100) NULL,
    `barcode` VARCHAR(100) NULL,
    `invoiceReference` VARCHAR(100) NULL,
    `warrantyExpiry` DATE NULL,
    `notes` TEXT NULL,
    `postedAt` DATETIME(3) NULL,
    `postedBy` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `fixed_assets_companyId_status_idx`(`companyId`, `status`),
    INDEX `fixed_assets_companyId_categoryId_idx`(`companyId`, `categoryId`),
    INDEX `fixed_assets_companyId_barcode_idx`(`companyId`, `barcode`),
    UNIQUE INDEX `fixed_assets_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fixed_asset_depreciation_runs` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `runNumber` VARCHAR(30) NOT NULL,
    `periodEnd` DATE NOT NULL,
    `status` ENUM('POSTED', 'UNPOSTED') NOT NULL DEFAULT 'POSTED',
    `activePeriodKey` VARCHAR(80) NULL,
    `totalAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `journalEntryId` VARCHAR(191) NULL,
    `branchId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `postedAt` DATETIME(3) NULL,
    `postedBy` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fixed_asset_depreciation_runs_activePeriodKey_key`(`activePeriodKey`),
    INDEX `fixed_asset_depreciation_runs_companyId_periodEnd_idx`(`companyId`, `periodEnd`),
    UNIQUE INDEX `fixed_asset_depreciation_runs_companyId_runNumber_key`(`companyId`, `runNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fixed_asset_depreciation_lines` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `periodMonth` DATE NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `accumulatedAfter` DECIMAL(18, 4) NOT NULL,
    `depreciationExpenseAccountId` VARCHAR(191) NOT NULL,
    `accumulatedDepreciationAccountId` VARCHAR(191) NOT NULL,
    `costCenterId` VARCHAR(191) NULL,

    INDEX `fixed_asset_depreciation_lines_assetId_periodMonth_idx`(`assetId`, `periodMonth`),
    UNIQUE INDEX `fixed_asset_depreciation_lines_runId_assetId_periodMonth_key`(`runId`, `assetId`, `periodMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fixed_asset_disposals` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `disposalNumber` VARCHAR(30) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `disposalType` ENUM('SALE', 'SCRAP') NOT NULL,
    `disposalDate` DATE NOT NULL,
    `status` ENUM('POSTED', 'UNPOSTED') NOT NULL DEFAULT 'POSTED',
    `activeAssetKey` VARCHAR(191) NULL,
    `proceeds` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `vatAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `proceedsAccountId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `catchUpDepreciation` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `catchUpMonths` INTEGER NOT NULL DEFAULT 0,
    `costAmount` DECIMAL(18, 4) NOT NULL,
    `accumulatedAmount` DECIMAL(18, 4) NOT NULL,
    `bookValue` DECIMAL(18, 4) NOT NULL,
    `gainLoss` DECIMAL(18, 4) NOT NULL,
    `previousStatus` ENUM('DRAFT', 'ACTIVE', 'FULLY_DEPRECIATED', 'DISPOSED') NOT NULL,
    `previousDepreciatedThrough` DATE NULL,
    `journalEntryId` VARCHAR(191) NULL,
    `branchId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `postedAt` DATETIME(3) NULL,
    `postedBy` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fixed_asset_disposals_activeAssetKey_key`(`activeAssetKey`),
    INDEX `fixed_asset_disposals_companyId_disposalDate_idx`(`companyId`, `disposalDate`),
    INDEX `fixed_asset_disposals_assetId_idx`(`assetId`),
    UNIQUE INDEX `fixed_asset_disposals_companyId_disposalNumber_key`(`companyId`, `disposalNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `fixed_asset_categories` ADD CONSTRAINT `fixed_asset_categories_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fixed_asset_categories` ADD CONSTRAINT `fixed_asset_categories_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `fixed_asset_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fixed_assets` ADD CONSTRAINT `fixed_assets_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fixed_assets` ADD CONSTRAINT `fixed_assets_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `fixed_asset_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fixed_asset_depreciation_runs` ADD CONSTRAINT `fixed_asset_depreciation_runs_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fixed_asset_depreciation_lines` ADD CONSTRAINT `fixed_asset_depreciation_lines_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `fixed_asset_depreciation_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fixed_asset_depreciation_lines` ADD CONSTRAINT `fixed_asset_depreciation_lines_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fixed_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fixed_asset_disposals` ADD CONSTRAINT `fixed_asset_disposals_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fixed_asset_disposals` ADD CONSTRAINT `fixed_asset_disposals_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fixed_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

