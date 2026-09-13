-- Wave 3 M11/M13: Contracting projects & extracts
-- MySQL 8

CREATE TABLE `contracting_settings` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `contractingRevenueAccountCode` VARCHAR(20) NULL,
  `projectExpenseAccountCode` VARCHAR(20) NULL,
  `clientReceivableAccountCode` VARCHAR(20) NULL,
  `subcontractorPayableAccountCode` VARCHAR(20) NULL,
  `customerAdvanceAccountCode` VARCHAR(20) NULL,
  `subcontractorAdvanceAccountCode` VARCHAR(20) NULL,
  `retentionHeldByOthersAccountCode` VARCHAR(20) NULL,
  `retentionWithheldForOthersAccountCode` VARCHAR(20) NULL,
  `outputVatAccountCode` VARCHAR(20) NULL,
  `whtAssetAccountCode` VARCHAR(20) NULL,
  `whtPayableAccountCode` VARCHAR(20) NULL,
  `defaultVatRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.14,
  `defaultWhtRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.01,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `contracting_settings_companyId_key` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `contracting_projects` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `projectCode` VARCHAR(191) NOT NULL,
  `projectName` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NULL,
  `contractValue` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `advancePaymentBalance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `advanceDeductionPercent` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  `retentionPercent` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  `costCenterId` VARCHAR(191) NULL,
  `startDate` DATETIME(3) NULL,
  `endDate` DATETIME(3) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `contracting_projects_companyId_projectCode_key` (`companyId`, `projectCode`),
  INDEX `contracting_projects_companyId_status_idx` (`companyId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `project_subcontracts` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `subcontractorId` VARCHAR(191) NOT NULL,
  `subcontractValue` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `advancePaymentBalance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `advanceRecoveryPercent` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  `retentionPercent` DECIMAL(8, 4) NOT NULL DEFAULT 0,
  `scopeOfWork` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `project_subcontracts_projectId_subcontractorId_key` (`projectId`, `subcontractorId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `client_extracts` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `extractNumber` VARCHAR(191) NOT NULL,
  `periodStart` DATETIME(3) NULL,
  `periodEnd` DATETIME(3) NULL,
  `grossAmount` DECIMAL(15, 2) NOT NULL,
  `advanceDeductionAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `retentionAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `vatAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `whtAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `netAmount` DECIMAL(15, 2) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `journalEntryId` VARCHAR(191) NULL,
  `postedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `client_extracts_companyId_extractNumber_key` (`companyId`, `extractNumber`),
  INDEX `client_extracts_projectId_idx` (`projectId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `subcontractor_extracts` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `projectSubcontractId` VARCHAR(191) NULL,
  `subcontractorId` VARCHAR(191) NOT NULL,
  `extractNumber` VARCHAR(191) NOT NULL,
  `periodStart` DATETIME(3) NULL,
  `periodEnd` DATETIME(3) NULL,
  `grossAmount` DECIMAL(15, 2) NOT NULL,
  `advanceDeductionAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `retentionAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `penaltyAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `materialDeductionAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `whtAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `netAmount` DECIMAL(15, 2) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `journalEntryId` VARCHAR(191) NULL,
  `postedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `subcontractor_extracts_companyId_extractNumber_key` (`companyId`, `extractNumber`),
  INDEX `subcontractor_extracts_projectId_subcontractorId_idx` (`projectId`, `subcontractorId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
