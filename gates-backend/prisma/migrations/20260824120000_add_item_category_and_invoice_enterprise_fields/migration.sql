-- Sales Invoice Enterprise Redesign: item categories (drive GL-account
-- defaulting for items), per-item barcode/GL overrides/tax profile, and
-- invoice delivery/tax-treatment tracking. All additive/nullable — no
-- destructive changes.

-- CreateTable
CREATE TABLE `item_categories` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `defaultInventoryAccountId` VARCHAR(191) NULL,
    `defaultSalesAccountId` VARCHAR(191) NULL,
    `defaultCogsAccountId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `item_categories_companyId_idx`(`companyId`),
    INDEX `item_categories_companyId_isActive_idx`(`companyId`, `isActive`),
    UNIQUE INDEX `item_categories_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `items`
    ADD COLUMN `categoryId` VARCHAR(191) NULL,
    ADD COLUMN `barcode` VARCHAR(191) NULL,
    ADD COLUMN `salesAccountId` VARCHAR(191) NULL,
    ADD COLUMN `cogsAccountId` VARCHAR(191) NULL,
    ADD COLUMN `defaultTaxPercent` DECIMAL(5, 2) NULL,
    ADD COLUMN `taxExemptionReason` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `invoices`
    ADD COLUMN `taxTreatmentType` VARCHAR(20) NULL,
    ADD COLUMN `isDelivered` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `handoverDate` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `items_categoryId_idx` ON `items`(`categoryId`);

-- CreateIndex
CREATE INDEX `items_companyId_barcode_idx` ON `items`(`companyId`, `barcode`);

-- AddForeignKey
ALTER TABLE `item_categories` ADD CONSTRAINT `item_categories_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `item_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
