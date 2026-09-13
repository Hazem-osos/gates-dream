-- CreateTable
CREATE TABLE `document_layout_configs` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `documentType` ENUM('ALL', 'CONTRACTOR_INVOICE', 'REAL_ESTATE_RECEIPT', 'TAX_INVOICE', 'DEBIT_NOTE', 'PAYMENT_SCHEDULE') NOT NULL DEFAULT 'ALL',
    `layoutPreset` ENUM('LIGHT', 'BUBBLE', 'WAVE', 'CORPORATE_DUAL', 'MINIMAL_BORDER', 'ARCHITECTURAL_GRID') NOT NULL DEFAULT 'LIGHT',
    `tableStyle` ENUM('LIGHT', 'BOXED', 'STRIPED', 'BUBBLE', 'COMPACT', 'BORDERLESS') NOT NULL DEFAULT 'LIGHT',
    `fontFamily` VARCHAR(60) NOT NULL DEFAULT 'Cairo',
    `primaryColor` VARCHAR(9) NOT NULL DEFAULT '#1e293b',
    `secondaryColor` VARCHAR(9) NOT NULL DEFAULT '#64748b',
    `textColor` VARCHAR(9) NOT NULL DEFAULT '#0f172a',
    `paperSize` ENUM('A4', 'LETTER', 'A5_LANDSCAPE') NOT NULL DEFAULT 'A4',
    `marginSize` ENUM('COMPACT_8MM', 'NORMAL_15MM', 'WIDE_20MM') NOT NULL DEFAULT 'NORMAL_15MM',
    `logoUrl` LONGTEXT NULL,
    `logoPosition` ENUM('LEFT', 'CENTER', 'RIGHT') NOT NULL DEFAULT 'LEFT',
    `logoWidth` INTEGER NOT NULL DEFAULT 150,
    `companyNameAr` VARCHAR(200) NULL,
    `companyNameEn` VARCHAR(200) NULL,
    `taxId` VARCHAR(60) NULL,
    `commercialReg` VARCHAR(60) NULL,
    `tagline` VARCHAR(200) NULL,
    `footerText` TEXT NULL,
    `bankDetails` JSON NULL,
    `showQrCode` BOOLEAN NOT NULL DEFAULT true,
    `showStampAndSignatures` BOOLEAN NOT NULL DEFAULT true,
    `signatureLabels` JSON NULL,
    `watermarkText` VARCHAR(60) NULL,
    `columnSettings` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_layout_configs_companyId_documentType_idx`(`companyId`, `documentType`),
    UNIQUE INDEX `document_layout_configs_companyId_branchId_documentType_key`(`companyId`, `branchId`, `documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- AddForeignKey
ALTER TABLE `document_layout_configs` ADD CONSTRAINT `document_layout_configs_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_layout_configs` ADD CONSTRAINT `document_layout_configs_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
