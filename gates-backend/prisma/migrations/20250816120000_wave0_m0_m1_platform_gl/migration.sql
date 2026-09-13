-- AlterTable
ALTER TABLE `api_keys` MODIFY `expiresAt` DATETIME NULL,
    MODIFY `lastUsedAt` DATETIME NULL;

-- AlterTable
ALTER TABLE `branches` ADD COLUMN `legacyBranchCode` VARCHAR(20) NULL;

-- AlterTable
ALTER TABLE `companies` ADD COLUMN `legacyCompanyCode` VARCHAR(20) NULL;

-- AlterTable
ALTER TABLE `journal_entries` ADD COLUMN `branchId` VARCHAR(191) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `descriptionAr` TEXT NULL,
    ADD COLUMN `descriptionEn` TEXT NULL,
    ADD COLUMN `documentStatus` VARCHAR(20) NOT NULL DEFAULT 'Open',
    ADD COLUMN `entryType` VARCHAR(20) NULL,
    ADD COLUMN `exchangeRate` DECIMAL(18, 6) NOT NULL DEFAULT 1,
    ADD COLUMN `fiscalYearId` VARCHAR(191) NULL,
    ADD COLUMN `isBalanced` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `legacyGlNum` VARCHAR(8) NULL,
    ADD COLUMN `postedAt` DATETIME(3) NULL,
    ADD COLUMN `postedBy` VARCHAR(191) NULL,
    ADD COLUMN `postingStatus` VARCHAR(10) NOT NULL DEFAULT 'UnPost',
    ADD COLUMN `sourceNumber` VARCHAR(30) NULL,
    ADD COLUMN `sourceType` VARCHAR(20) NULL,
    ADD COLUMN `sourceYearId` VARCHAR(20) NULL,
    MODIFY `currencyCode` VARCHAR(10) NOT NULL;

-- Sync legacy posting flag
UPDATE `journal_entries` SET `postingStatus` = 'Post' WHERE `isPosted` = true;

-- AlterTable (journal lines — add nullable lineNumber first for backfill)
ALTER TABLE `journal_entry_lines` ADD COLUMN `creditBase` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `debitBase` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `descriptionAr` TEXT NULL,
    ADD COLUMN `descriptionEn` TEXT NULL,
    ADD COLUMN `exchangeRate` DECIMAL(18, 6) NOT NULL DEFAULT 1,
    ADD COLUMN `lineNumber` INTEGER NULL,
    ADD COLUMN `taxPercentCode` VARCHAR(20) NULL,
    MODIFY `debit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    MODIFY `credit` DECIMAL(18, 4) NOT NULL DEFAULT 0;

UPDATE `journal_entry_lines` SET
    `lineNumber` = `lineOrder`,
    `debitBase` = `debit` * `exchangeRate`,
    `creditBase` = `credit` * `exchangeRate`
WHERE `lineNumber` IS NULL;

ALTER TABLE `journal_entry_lines` MODIFY `lineNumber` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `company_setting_entries` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `company_setting_entries_companyId_idx`(`companyId`),
    UNIQUE INDEX `company_setting_entries_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fiscal_years` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `legacyYearId` VARCHAR(20) NOT NULL,
    `arabicName` VARCHAR(191) NULL,
    `englishName` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'Open',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `fiscal_years_companyId_status_idx`(`companyId`, `status`),
    UNIQUE INDEX `fiscal_years_companyId_legacyYearId_key`(`companyId`, `legacyYearId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fiscal_periods` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `fiscalYearId` VARCHAR(191) NOT NULL,
    `periodNumber` INTEGER NOT NULL,
    `name` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `isClosed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `fiscal_periods_companyId_startDate_endDate_idx`(`companyId`, `startDate`, `endDate`),
    UNIQUE INDEX `fiscal_periods_fiscalYearId_periodNumber_key`(`fiscalYearId`, `periodNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_sequences` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `fiscalYearId` VARCHAR(191) NULL,
    `docType` VARCHAR(30) NOT NULL,
    `scope` CHAR(1) NOT NULL DEFAULT 'Y',
    `lastNumber` INTEGER NOT NULL DEFAULT 0,
    `padding` INTEGER NOT NULL DEFAULT 8,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_sequences_companyId_docType_idx`(`companyId`, `docType`),
    UNIQUE INDEX `document_sequences_companyId_branchId_fiscalYearId_docType_key`(`companyId`, `branchId`, `fiscalYearId`, `docType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gl_posting_violations` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `journalEntryId` VARCHAR(191) NOT NULL,
    `violationType` VARCHAR(10) NOT NULL,
    `accountCode` VARCHAR(20) NULL,
    `costCenterCode` VARCHAR(20) NULL,
    `message` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gl_posting_violations_journalEntryId_idx`(`journalEntryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `branches_companyId_legacyBranchCode_key` ON `branches`(`companyId`, `legacyBranchCode`);

-- CreateIndex
CREATE UNIQUE INDEX `companies_legacyCompanyCode_key` ON `companies`(`legacyCompanyCode`);

-- CreateIndex
CREATE INDEX `journal_entries_companyId_postingStatus_idx` ON `journal_entries`(`companyId`, `postingStatus`);

-- CreateIndex
CREATE UNIQUE INDEX `journal_entries_companyId_branchId_fiscalYearId_legacyGlNum_key` ON `journal_entries`(`companyId`, `branchId`, `fiscalYearId`, `legacyGlNum`);

-- CreateIndex
CREATE UNIQUE INDEX `journal_entry_lines_journalEntryId_lineNumber_key` ON `journal_entry_lines`(`journalEntryId`, `lineNumber`);

-- AddForeignKey
ALTER TABLE `company_setting_entries` ADD CONSTRAINT `company_setting_entries_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fiscal_years` ADD CONSTRAINT `fiscal_years_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fiscal_periods` ADD CONSTRAINT `fiscal_periods_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fiscal_periods` ADD CONSTRAINT `fiscal_periods_fiscalYearId_fkey` FOREIGN KEY (`fiscalYearId`) REFERENCES `fiscal_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_sequences` ADD CONSTRAINT `document_sequences_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_sequences` ADD CONSTRAINT `document_sequences_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_sequences` ADD CONSTRAINT `document_sequences_fiscalYearId_fkey` FOREIGN KEY (`fiscalYearId`) REFERENCES `fiscal_years`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_fiscalYearId_fkey` FOREIGN KEY (`fiscalYearId`) REFERENCES `fiscal_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gl_posting_violations` ADD CONSTRAINT `gl_posting_violations_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gl_posting_violations` ADD CONSTRAINT `gl_posting_violations_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

