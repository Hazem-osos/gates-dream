-- Wave 1 M2: Treasury GL links, cheque lifecycle, cash box rights
-- MySQL 8

ALTER TABLE `safes`
  ADD COLUMN `glAccountId` VARCHAR(191) NULL,
  ADD INDEX `safes_glAccountId_idx` (`glAccountId`);

ALTER TABLE `bank_accounts`
  ADD COLUMN `glAccountId` VARCHAR(191) NULL,
  ADD INDEX `bank_accounts_glAccountId_idx` (`glAccountId`);

ALTER TABLE `treasury_receipts`
  ADD COLUMN `fiscalYearId` VARCHAR(191) NULL,
  ADD COLUMN `sourceYearId` VARCHAR(20) NULL,
  ADD COLUMN `postedBy` VARCHAR(191) NULL,
  ADD INDEX `treasury_receipts_fiscalYearId_idx` (`fiscalYearId`);

ALTER TABLE `treasury_payments`
  ADD COLUMN `fiscalYearId` VARCHAR(191) NULL,
  ADD COLUMN `sourceYearId` VARCHAR(20) NULL,
  ADD COLUMN `postedBy` VARCHAR(191) NULL,
  ADD INDEX `treasury_payments_fiscalYearId_idx` (`fiscalYearId`);

CREATE TABLE `cheques` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `fiscalYearId` VARCHAR(191) NULL,
  `direction` VARCHAR(20) NOT NULL,
  `status` VARCHAR(30) NOT NULL,
  `chequeNumber` VARCHAR(50) NOT NULL,
  `bankName` VARCHAR(191) NULL,
  `dueDate` DATETIME(3) NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `currencyCode` VARCHAR(10) NOT NULL,
  `sourceYearId` VARCHAR(20) NULL,
  `customerId` VARCHAR(191) NULL,
  `supplierId` VARCHAR(191) NULL,
  `bankAccountId` VARCHAR(191) NULL,
  `description` TEXT NULL,
  `portfolioJournalEntryId` VARCHAR(191) NULL,
  `depositJournalEntryId` VARCHAR(191) NULL,
  `clearJournalEntryId` VARCHAR(191) NULL,
  `issueJournalEntryId` VARCHAR(191) NULL,
  `cancelJournalEntryId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `cheques_companyId_chequeNumber_direction_key` (`companyId`, `chequeNumber`, `direction`),
  INDEX `cheques_companyId_status_idx` (`companyId`, `status`),
  INDEX `cheques_customerId_idx` (`customerId`),
  INDEX `cheques_supplierId_idx` (`supplierId`),
  INDEX `cheques_bankAccountId_idx` (`bankAccountId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bank_box_rights` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `safeId` VARCHAR(191) NULL,
  `bankAccountId` VARCHAR(191) NULL,
  `canView` BOOLEAN NOT NULL DEFAULT true,
  `canPost` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `bank_box_rights_companyId_userId_safeId_bankAccountId_key` (`companyId`, `userId`, `safeId`, `bankAccountId`),
  INDEX `bank_box_rights_companyId_userId_idx` (`companyId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Unified cash transaction header (links to receipt or payment voucher)
CREATE TABLE `cash_transactions` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `fiscalYearId` VARCHAR(191) NULL,
  `transactionKind` VARCHAR(20) NOT NULL,
  `voucherNumber` VARCHAR(50) NULL,
  `date` DATETIME(3) NOT NULL,
  `description` TEXT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `currencyCode` VARCHAR(10) NOT NULL,
  `customerId` VARCHAR(191) NULL,
  `supplierId` VARCHAR(191) NULL,
  `offsetAccountId` VARCHAR(191) NULL,
  `safeId` VARCHAR(191) NULL,
  `bankAccountId` VARCHAR(191) NULL,
  `treasuryReceiptId` VARCHAR(191) NULL,
  `treasuryPaymentId` VARCHAR(191) NULL,
  `journalEntryId` VARCHAR(191) NULL,
  `isPosted` BOOLEAN NOT NULL DEFAULT false,
  `postedAt` DATETIME(3) NULL,
  `postedBy` VARCHAR(191) NULL,
  `isCancelled` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `cash_transactions_treasuryReceiptId_key` (`treasuryReceiptId`),
  UNIQUE INDEX `cash_transactions_treasuryPaymentId_key` (`treasuryPaymentId`),
  INDEX `cash_transactions_companyId_date_idx` (`companyId`, `date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
