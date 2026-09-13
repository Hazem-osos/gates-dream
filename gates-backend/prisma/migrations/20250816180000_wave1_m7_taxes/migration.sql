-- Wave 1 M7: Tax periods, declarations, settlements
-- MySQL 8

CREATE TABLE `tax_periods` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `fiscalYearId` VARCHAR(191) NOT NULL,
  `periodNumber` INT NOT NULL,
  `periodName` VARCHAR(191) NULL,
  `periodType` VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
  `sourceYearId` VARCHAR(20) NULL,
  `startDate` DATETIME(3) NOT NULL,
  `endDate` DATETIME(3) NOT NULL,
  `status` VARCHAR(10) NOT NULL DEFAULT 'OPEN',
  `closedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `tax_periods_companyId_fiscalYearId_periodNumber_key` (`companyId`, `fiscalYearId`, `periodNumber`),
  INDEX `tax_periods_companyId_startDate_endDate_idx` (`companyId`, `startDate`, `endDate`),
  INDEX `tax_periods_companyId_status_idx` (`companyId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tax_declarations` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `taxPeriodId` VARCHAR(191) NOT NULL,
  `fiscalYearId` VARCHAR(191) NULL,
  `totalOutputVat` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalInputVat` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `netVatAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalWithholdingTax` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `settlementJournalEntryId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `tax_declarations_companyId_taxPeriodId_key` (`companyId`, `taxPeriodId`),
  INDEX `tax_declarations_settlementJournalEntryId_idx` (`settlementJournalEntryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tax_settlements` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `taxDeclarationId` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `currencyCode` VARCHAR(10) NOT NULL DEFAULT 'EGP',
  `paymentJournalEntryId` VARCHAR(191) NULL,
  `safeId` VARCHAR(191) NULL,
  `bankAccountId` VARCHAR(191) NULL,
  `settledAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `tax_settlements_companyId_taxDeclarationId_idx` (`companyId`, `taxDeclarationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
