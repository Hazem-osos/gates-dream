-- Wave 2 M15 / M23: Letters of credit & bank guarantees
-- MySQL 8

CREATE TABLE `trade_settings` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `openLcWipAccountCode` VARCHAR(20) NULL,
  `inventoryAccountCode` VARCHAR(20) NULL,
  `lcPayableAccountCode` VARCHAR(20) NULL,
  `lgCashCoverAccountCode` VARCHAR(20) NULL,
  `bankCommissionAccountCode` VARCHAR(20) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `trade_settings_companyId_key` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `letter_of_credits` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `fiscalYearId` VARCHAR(191) NULL,
  `sourceYearId` VARCHAR(20) NULL,
  `lcNumber` VARCHAR(191) NOT NULL,
  `supplierId` VARCHAR(191) NULL,
  `bankAccountId` VARCHAR(191) NULL,
  `warehouseId` VARCHAR(191) NULL,
  `currencyCode` VARCHAR(10) NOT NULL DEFAULT 'EGP',
  `exchangeRate` DECIMAL(18, 6) NOT NULL DEFAULT 1,
  `totalAmountFx` DECIMAL(15, 2) NOT NULL,
  `merchandiseBase` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalLandedCost` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  `expiryDate` DATETIME(3) NULL,
  `openingJournalEntryId` VARCHAR(191) NULL,
  `clearingJournalEntryId` VARCHAR(191) NULL,
  `issueDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `clearedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `letter_of_credits_companyId_lcNumber_key` (`companyId`, `lcNumber`),
  INDEX `letter_of_credits_companyId_status_idx` (`companyId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lc_expenses` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `lcId` VARCHAR(191) NOT NULL,
  `expenseType` VARCHAR(40) NOT NULL,
  `description` VARCHAR(191) NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `currencyCode` VARCHAR(10) NOT NULL DEFAULT 'EGP',
  `exchangeRate` DECIMAL(18, 6) NOT NULL DEFAULT 1,
  `amountBase` DECIMAL(15, 2) NOT NULL,
  `expenseDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `journalEntryId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `lc_expenses_lcId_idx` (`lcId`),
  INDEX `lc_expenses_companyId_idx` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lc_receipt_lines` (
  `id` VARCHAR(191) NOT NULL,
  `lcId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `unitId` VARCHAR(191) NULL,
  `quantity` DECIMAL(15, 4) NOT NULL,
  `merchandiseBase` DECIMAL(15, 2) NOT NULL,
  `allocatedExpenseBase` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `landedUnitCostBase` DECIMAL(15, 4) NOT NULL,
  `lineOrder` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `lc_receipt_lines_lcId_idx` (`lcId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `guarantee_letters` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `fiscalYearId` VARCHAR(191) NULL,
  `sourceYearId` VARCHAR(20) NULL,
  `lgNumber` VARCHAR(191) NOT NULL,
  `lgType` VARCHAR(30) NOT NULL,
  `bankAccountId` VARCHAR(191) NULL,
  `beneficiaryName` VARCHAR(191) NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `cashCoverAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `commissionAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `currencyCode` VARCHAR(10) NOT NULL DEFAULT 'EGP',
  `issueDate` DATETIME(3) NOT NULL,
  `expiryDate` DATETIME(3) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `issueJournalEntryId` VARCHAR(191) NULL,
  `releaseJournalEntryId` VARCHAR(191) NULL,
  `extendedAt` DATETIME(3) NULL,
  `releasedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `guarantee_letters_companyId_lgNumber_key` (`companyId`, `lgNumber`),
  INDEX `guarantee_letters_companyId_status_idx` (`companyId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
