/*
  Warnings:

  - The primary key for the `bank_accounts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `code` on the `bank_accounts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `arabicName` on the `bank_accounts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `englishName` on the `bank_accounts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `accountNumber` on the `bank_accounts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `iban` on the `bank_accounts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `currencyCode` on the `bank_accounts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - The primary key for the `banks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `code` on the `banks` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `arabicName` on the `banks` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `englishName` on the `banks` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - The primary key for the `safes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `code` on the `safes` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `arabicName` on the `safes` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `englishName` on the `safes` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `currencyCode` on the `safes` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - The primary key for the `securities_payments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `serial` on the `securities_payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `paymentNumber` on the `securities_payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `hijriDate` on the `securities_payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `securityType` on the `securities_payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `payeeName` on the `securities_payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `payeeBank` on the `securities_payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `securityNumber` on the `securities_payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `currencyCode` on the `securities_payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - The primary key for the `securities_receipts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `serial` on the `securities_receipts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `receiptNumber` on the `securities_receipts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `hijriDate` on the `securities_receipts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `securityType` on the `securities_receipts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `issuerName` on the `securities_receipts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `issuerBank` on the `securities_receipts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `securityNumber` on the `securities_receipts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `currencyCode` on the `securities_receipts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - The primary key for the `securities_renewals` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `serial` on the `securities_renewals` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `renewalNumber` on the `securities_renewals` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `hijriDate` on the `securities_renewals` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `originalSecurityId` on the `securities_renewals` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `originalSecurityType` on the `securities_renewals` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - The primary key for the `treasury_payments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `serial` on the `treasury_payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `voucherNumber` on the `treasury_payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `hijriDate` on the `treasury_payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `paymentType` on the `treasury_payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `currencyCode` on the `treasury_payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - The primary key for the `treasury_receipts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `serial` on the `treasury_receipts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `voucherNumber` on the `treasury_receipts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `hijriDate` on the `treasury_receipts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `receiptType` on the `treasury_receipts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `currencyCode` on the `treasury_receipts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to drop the `audit_checkpoints` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex statements removed - indexes will be created by CREATE TABLE/ALTER TABLE statements below
-- Note: MySQL doesn't support IF EXISTS for DROP INDEX, so we skip dropping indexes that may not exist

-- AlterTable
ALTER TABLE `bank_accounts` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `companyId` VARCHAR(191) NOT NULL,
    MODIFY `bankId` VARCHAR(191) NOT NULL,
    MODIFY `code` VARCHAR(191) NULL,
    MODIFY `arabicName` VARCHAR(191) NOT NULL,
    MODIFY `englishName` VARCHAR(191) NULL,
    MODIFY `accountNumber` VARCHAR(191) NULL,
    MODIFY `iban` VARCHAR(191) NULL,
    MODIFY `currencyCode` VARCHAR(191) NOT NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `banks` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `companyId` VARCHAR(191) NOT NULL,
    MODIFY `code` VARCHAR(191) NULL,
    MODIFY `arabicName` VARCHAR(191) NOT NULL,
    MODIFY `englishName` VARCHAR(191) NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `safes` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `companyId` VARCHAR(191) NOT NULL,
    MODIFY `code` VARCHAR(191) NULL,
    MODIFY `arabicName` VARCHAR(191) NOT NULL,
    MODIFY `englishName` VARCHAR(191) NULL,
    MODIFY `currencyCode` VARCHAR(191) NOT NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `securities_payments` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `companyId` VARCHAR(191) NOT NULL,
    MODIFY `branchId` VARCHAR(191) NULL,
    MODIFY `serial` VARCHAR(191) NULL,
    MODIFY `paymentNumber` VARCHAR(191) NULL,
    MODIFY `hijriDate` VARCHAR(191) NULL,
    MODIFY `securityType` VARCHAR(191) NOT NULL,
    MODIFY `customerId` VARCHAR(191) NULL,
    MODIFY `supplierId` VARCHAR(191) NULL,
    MODIFY `payeeName` VARCHAR(191) NULL,
    MODIFY `payeeBank` VARCHAR(191) NULL,
    MODIFY `securityNumber` VARCHAR(191) NULL,
    MODIFY `currencyCode` VARCHAR(191) NOT NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `securities_receipts` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `companyId` VARCHAR(191) NOT NULL,
    MODIFY `branchId` VARCHAR(191) NULL,
    MODIFY `serial` VARCHAR(191) NULL,
    MODIFY `receiptNumber` VARCHAR(191) NULL,
    MODIFY `hijriDate` VARCHAR(191) NULL,
    MODIFY `securityType` VARCHAR(191) NOT NULL,
    MODIFY `customerId` VARCHAR(191) NULL,
    MODIFY `supplierId` VARCHAR(191) NULL,
    MODIFY `issuerName` VARCHAR(191) NULL,
    MODIFY `issuerBank` VARCHAR(191) NULL,
    MODIFY `securityNumber` VARCHAR(191) NULL,
    MODIFY `currencyCode` VARCHAR(191) NOT NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `securities_renewals` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `companyId` VARCHAR(191) NOT NULL,
    MODIFY `branchId` VARCHAR(191) NULL,
    MODIFY `serial` VARCHAR(191) NULL,
    MODIFY `renewalNumber` VARCHAR(191) NULL,
    MODIFY `hijriDate` VARCHAR(191) NULL,
    MODIFY `originalSecurityId` VARCHAR(191) NULL,
    MODIFY `originalSecurityType` VARCHAR(191) NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `treasury_payments` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `companyId` VARCHAR(191) NOT NULL,
    MODIFY `branchId` VARCHAR(191) NULL,
    MODIFY `serial` VARCHAR(191) NULL,
    MODIFY `voucherNumber` VARCHAR(191) NULL,
    MODIFY `hijriDate` VARCHAR(191) NULL,
    MODIFY `paymentType` VARCHAR(191) NOT NULL,
    MODIFY `safeId` VARCHAR(191) NULL,
    MODIFY `bankAccountId` VARCHAR(191) NULL,
    MODIFY `accountId` VARCHAR(191) NULL,
    MODIFY `customerId` VARCHAR(191) NULL,
    MODIFY `supplierId` VARCHAR(191) NULL,
    MODIFY `currencyCode` VARCHAR(191) NOT NULL,
    MODIFY `journalEntryId` VARCHAR(191) NULL,
    MODIFY `bankId` VARCHAR(191) NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `treasury_receipts` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `companyId` VARCHAR(191) NOT NULL,
    MODIFY `branchId` VARCHAR(191) NULL,
    MODIFY `serial` VARCHAR(191) NULL,
    MODIFY `voucherNumber` VARCHAR(191) NULL,
    MODIFY `hijriDate` VARCHAR(191) NULL,
    MODIFY `receiptType` VARCHAR(191) NOT NULL,
    MODIFY `customerId` VARCHAR(191) NULL,
    MODIFY `supplierId` VARCHAR(191) NULL,
    MODIFY `accountId` VARCHAR(191) NULL,
    MODIFY `safeId` VARCHAR(191) NULL,
    MODIFY `bankAccountId` VARCHAR(191) NULL,
    MODIFY `currencyCode` VARCHAR(191) NOT NULL,
    MODIFY `journalEntryId` VARCHAR(191) NULL,
    MODIFY `bankId` VARCHAR(191) NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT,
    ADD PRIMARY KEY (`id`);

-- DropTable (skip if table doesn't exist)
-- DROP TABLE IF EXISTS `audit_checkpoints`; -- MySQL doesn't support IF EXISTS for DROP TABLE, so we skip this

-- CreateTable
CREATE TABLE `tenants` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users_legacy` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `users_legacy_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `users_legacy_tenantId_email_key`(`tenantId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_limits` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NULL,
    `key` VARCHAR(191) NOT NULL,
    `window` DATETIME(3) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,

    INDEX `rate_limits_tenantId_key_idx`(`tenantId`, `key`),
    UNIQUE INDEX `rate_limits_tenantId_userId_key_window_key`(`tenantId`, `userId`, `key`, `window`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `tableName` VARCHAR(191) NOT NULL,
    `rowId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `oldValues` JSON NULL,
    `newValues` JSON NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `by` VARCHAR(191) NULL,
    `requestId` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `prevHash` VARCHAR(191) NULL,
    `rowHash` VARCHAR(191) NULL,

    INDEX `audit_logs_tenantId_tableName_at_idx`(`tenantId`, `tableName`, `at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `actorId` CHAR(36) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `subjectType` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `requestId` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `impersonatedBy` VARCHAR(191) NULL,

    INDEX `activity_logs_tenantId_kind_at_idx`(`tenantId`, `kind`, `at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `companies` (
    `id` VARCHAR(191) NOT NULL,
    `serial` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `entityType` VARCHAR(191) NULL,
    `entityTypeCode` VARCHAR(191) NULL,
    `entityNumber` VARCHAR(191) NULL,
    `phone1` VARCHAR(191) NULL,
    `phone2` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `taxNumber1` VARCHAR(191) NULL,
    `taxNumber2` VARCHAR(191) NULL,
    `taxNumber3` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `companies_serial_key`(`serial`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `serial` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `branchNumber` VARCHAR(191) NULL,
    `activationNumber` VARCHAR(191) NULL,
    `priceList` VARCHAR(191) NULL,
    `registrationNumber` VARCHAR(191) NULL,
    `barcodePrice` VARCHAR(191) NULL,
    `governorate` VARCHAR(191) NULL,
    `district` VARCHAR(191) NULL,
    `streetName` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `buildingNumber` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `branches_serial_key`(`serial`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_settings` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `fiscalYearStart` VARCHAR(191) NULL,
    `fiscalYearEnd` VARCHAR(191) NULL,
    `defaultCurrency` VARCHAR(191) NULL,
    `journalEntryDigits` INTEGER NULL DEFAULT 6,
    `allowNegativeBalance` BOOLEAN NULL DEFAULT false,
    `allowCostCenterWithoutAccount` BOOLEAN NULL DEFAULT false,
    `lockPostingBeforeDate` VARCHAR(191) NULL,
    `enableApprovalsWorkflow` BOOLEAN NULL DEFAULT true,
    `autoNumbering` BOOLEAN NULL DEFAULT true,
    `decimalsInAmounts` INTEGER NULL DEFAULT 2,
    `accountsGuideDigits` INTEGER NULL,
    `costCentersGuideDigits` INTEGER NULL,
    `storesGuideDigits` INTEGER NULL,
    `itemsGuideDigits` INTEGER NULL,
    `dateUsage` VARCHAR(191) NULL,
    `operationsFromDate` VARCHAR(191) NULL,
    `dueSecuritiesWarningDays` INTEGER NULL,
    `budgetAllowExceed` BOOLEAN NULL DEFAULT false,
    `budgetWarnHalf` BOOLEAN NULL DEFAULT false,
    `budgetWarnSame` BOOLEAN NULL DEFAULT false,
    `budgetWarnExceed` BOOLEAN NULL DEFAULT false,
    `budgetStopMessageOnly` BOOLEAN NULL DEFAULT false,
    `budgetStopLedger` BOOLEAN NULL DEFAULT false,
    `budgetStopOrigin` BOOLEAN NULL DEFAULT false,
    `budgetStopBoth` BOOLEAN NULL DEFAULT false,
    `backupPath` VARCHAR(191) NULL,
    `costMethod` VARCHAR(191) NULL,
    `theme` VARCHAR(191) NULL,
    `temporaryReceipts` BOOLEAN NULL DEFAULT false,
    `documentaryCredits` BOOLEAN NULL DEFAULT false,
    `advancedSettings` JSON NULL,
    `accountDefinitions` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `company_settings_companyId_key`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_branch_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `user_branch_permissions_userId_idx`(`userId`),
    INDEX `user_branch_permissions_branchId_idx`(`branchId`),
    INDEX `user_branch_permissions_companyId_idx`(`companyId`),
    UNIQUE INDEX `user_branch_permissions_userId_branchId_key`(`userId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_groups` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `priceList` VARCHAR(191) NULL,
    `hidePricesInInvoices` BOOLEAN NULL DEFAULT false,
    `allowChangePaymentValue` BOOLEAN NULL DEFAULT false,
    `posManager` BOOLEAN NULL DEFAULT false,
    `deactivate` BOOLEAN NULL DEFAULT false,
    `studentAffairs` BOOLEAN NULL DEFAULT false,
    `busManager` BOOLEAN NULL DEFAULT false,
    `studentAccounts` BOOLEAN NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_group_members` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `userGroupId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_group_members_userId_idx`(`userId`),
    INDEX `user_group_members_userGroupId_idx`(`userGroupId`),
    INDEX `user_group_members_companyId_idx`(`companyId`),
    UNIQUE INDEX `user_group_members_userId_userGroupId_key`(`userId`, `userGroupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `resource` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NULL,
    `branchId` VARCHAR(191) NULL,
    `allow` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `user_permissions_userId_idx`(`userId`),
    INDEX `user_permissions_companyId_idx`(`companyId`),
    INDEX `user_permissions_resource_action_idx`(`resource`, `action`),
    INDEX `user_permissions_module_idx`(`module`),
    INDEX `user_permissions_branchId_idx`(`branchId`),
    UNIQUE INDEX `user_permissions_userId_resource_action_module_branchId_key`(`userId`, `resource`(100), `action`(50), `module`(100), `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_advanced_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `permissions` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `user_advanced_permissions_userId_idx`(`userId`),
    INDEX `user_advanced_permissions_companyId_idx`(`companyId`),
    INDEX `user_advanced_permissions_branchId_idx`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `accountType` VARCHAR(191) NULL,
    `parentId` VARCHAR(191) NULL,
    `accountSide` VARCHAR(191) NULL,
    `costCenterRequired` VARCHAR(191) NULL,
    `warning` VARCHAR(191) NULL,
    `budget` DECIMAL(15, 2) NULL,
    `currencyCode` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `accounts_companyId_idx`(`companyId`),
    INDEX `accounts_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cost_centers` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cost_centers_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cost_center_movements` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `costCenterId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `debit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `credit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cost_center_movements_companyId_date_idx`(`companyId`, `date`),
    INDEX `cost_center_movements_accountId_idx`(`accountId`),
    INDEX `cost_center_movements_costCenterId_idx`(`costCenterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_entries` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `voucherNumber` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `hijriDate` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `currencyCode` VARCHAR(191) NOT NULL,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `isCyclic` BOOLEAN NOT NULL DEFAULT false,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `journal_entries_companyId_date_idx`(`companyId`, `date`),
    INDEX `journal_entries_voucherNumber_idx`(`voucherNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_entry_lines` (
    `id` VARCHAR(191) NOT NULL,
    `journalEntryId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `costCenterId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `debit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `credit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `lineOrder` INTEGER NOT NULL,

    INDEX `journal_entry_lines_journalEntryId_idx`(`journalEntryId`),
    INDEX `journal_entry_lines_accountId_idx`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `serial` VARCHAR(191) NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `customerType` VARCHAR(191) NULL,
    `how` VARCHAR(191) NULL,
    `nationality` VARCHAR(191) NULL,
    `taxData` BOOLEAN NOT NULL DEFAULT false,
    `taxAuthority` VARCHAR(191) NULL,
    `taxAuthorityName` VARCHAR(191) NULL,
    `phone1` VARCHAR(191) NULL,
    `phone2` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `fax` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `area` VARCHAR(191) NULL,
    `street` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `poBox` VARCHAR(191) NULL,
    `mainAccountId` VARCHAR(191) NULL,
    `accountId` VARCHAR(191) NULL,
    `representativeId` VARCHAR(191) NULL,
    `priceListId` VARCHAR(191) NULL,
    `sellingPrice` VARCHAR(191) NULL,
    `transactionType` VARCHAR(191) NULL,
    `warning` VARCHAR(191) NULL,
    `estimatedBudget` DECIMAL(15, 2) NULL,
    `currencyCode` VARCHAR(191) NULL,
    `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `customers_companyId_idx`(`companyId`),
    INDEX `customers_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `serial` VARCHAR(191) NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `supplierType` VARCHAR(191) NULL,
    `how` VARCHAR(191) NULL,
    `nationality` VARCHAR(191) NULL,
    `taxData` BOOLEAN NOT NULL DEFAULT false,
    `taxAuthority` VARCHAR(191) NULL,
    `taxAuthorityName` VARCHAR(191) NULL,
    `phone1` VARCHAR(191) NULL,
    `phone2` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `fax` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `area` VARCHAR(191) NULL,
    `street` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `poBox` VARCHAR(191) NULL,
    `mainAccountId` VARCHAR(191) NULL,
    `accountId` VARCHAR(191) NULL,
    `transactionType` VARCHAR(191) NULL,
    `warning` VARCHAR(191) NULL,
    `estimatedBudget` DECIMAL(15, 2) NULL,
    `currencyCode` VARCHAR(191) NULL,
    `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `suppliers_companyId_idx`(`companyId`),
    INDEX `suppliers_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `delegates` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `phone1` VARCHAR(191) NULL,
    `phone2` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `commissionPercentage` DECIMAL(5, 2) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `delegates_companyId_idx`(`companyId`),
    INDEX `delegates_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `currencies` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `exchangeRate` DECIMAL(15, 6) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `currencies_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `periods` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isClosed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `periods_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `units` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `units_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `serial` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `mainAccountId` VARCHAR(191) NULL,
    `costCenterId` VARCHAR(191) NULL,
    `specifications` TEXT NULL,
    `itemType` VARCHAR(191) NULL,
    `weight` DECIMAL(10, 3) NULL,
    `manufacturerId` VARCHAR(191) NULL,
    `colorId` VARCHAR(191) NULL,
    `countryOfOrigin` VARCHAR(191) NULL,
    `quality` VARCHAR(191) NULL,
    `size` VARCHAR(191) NULL,
    `property1` VARCHAR(191) NULL,
    `property2` VARCHAR(191) NULL,
    `property3` VARCHAR(191) NULL,
    `property4` VARCHAR(191) NULL,
    `property5` VARCHAR(191) NULL,
    `useExpirationDate` BOOLEAN NOT NULL DEFAULT false,
    `inactiveItem` BOOLEAN NOT NULL DEFAULT false,
    `notSubjectToTerms` BOOLEAN NOT NULL DEFAULT false,
    `cannotBeReturned` BOOLEAN NOT NULL DEFAULT false,
    `noSellBelowCost` BOOLEAN NOT NULL DEFAULT false,
    `useSerialNumber` BOOLEAN NOT NULL DEFAULT false,
    `clothingItem` BOOLEAN NOT NULL DEFAULT false,
    `upperLimit` DECIMAL(15, 3) NULL,
    `orderLimit` DECIMAL(15, 3) NULL,
    `orderLimitPercentage` DECIMAL(5, 2) NULL,
    `lowerLimit` DECIMAL(15, 3) NULL,
    `beginningBalance` DECIMAL(15, 3) NULL,
    `beginningCostPrice` DECIMAL(15, 2) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `items_companyId_idx`(`companyId`),
    INDEX `items_serial_idx`(`serial`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_units` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `conversionFactor` DECIMAL(15, 6) NOT NULL DEFAULT 1,
    `isBaseUnit` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `item_units_itemId_unitId_key`(`itemId`, `unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_lists` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `price_lists_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_prices` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `priceListId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `price` DECIMAL(15, 2) NOT NULL,

    UNIQUE INDEX `item_prices_itemId_priceListId_unitId_key`(`itemId`, `priceListId`, `unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `warehouses` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `branchId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `warehouses_companyId_idx`(`companyId`),
    INDEX `warehouses_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `locations` (
    `id` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `locations_warehouseId_idx`(`warehouseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_quantities` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `quantity` DECIMAL(15, 3) NOT NULL DEFAULT 0,

    UNIQUE INDEX `item_quantities_itemId_warehouseId_locationId_key`(`itemId`, `warehouseId`, `locationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opening_stocks` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `opening_stocks_companyId_idx`(`companyId`),
    INDEX `opening_stocks_branchId_idx`(`branchId`),
    INDEX `opening_stocks_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opening_stock_lines` (
    `id` VARCHAR(191) NOT NULL,
    `openingStockId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unitPrice` DECIMAL(15, 2) NOT NULL,
    `total` DECIMAL(15, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `opening_stock_lines_openingStockId_idx`(`openingStockId`),
    INDEX `opening_stock_lines_itemId_idx`(`itemId`),
    INDEX `opening_stock_lines_warehouseId_idx`(`warehouseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stocktaking` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `totalShortage` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalIncrease` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `stocktaking_companyId_idx`(`companyId`),
    INDEX `stocktaking_branchId_idx`(`branchId`),
    INDEX `stocktaking_warehouseId_idx`(`warehouseId`),
    INDEX `stocktaking_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stocktaking_lines` (
    `id` VARCHAR(191) NOT NULL,
    `stocktakingId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `unitId` VARCHAR(191) NULL,
    `bookQuantity` DECIMAL(15, 3) NOT NULL,
    `actualQuantity` DECIMAL(15, 3) NOT NULL,
    `unitPrice` DECIMAL(15, 2) NOT NULL,
    `shortageQuantity` DECIMAL(15, 3) NULL,
    `increaseQuantity` DECIMAL(15, 3) NULL,
    `shortageTotal` DECIMAL(15, 2) NULL,
    `increaseTotal` DECIMAL(15, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `stocktaking_lines_stocktakingId_idx`(`stocktakingId`),
    INDEX `stocktaking_lines_itemId_idx`(`itemId`),
    INDEX `stocktaking_lines_warehouseId_idx`(`warehouseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transfers` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `fromWarehouseId` VARCHAR(191) NOT NULL,
    `toWarehouseId` VARCHAR(191) NOT NULL,
    `fromCostCenterId` VARCHAR(191) NULL,
    `toCostCenterId` VARCHAR(191) NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `transfers_companyId_idx`(`companyId`),
    INDEX `transfers_branchId_idx`(`branchId`),
    INDEX `transfers_fromWarehouseId_idx`(`fromWarehouseId`),
    INDEX `transfers_toWarehouseId_idx`(`toWarehouseId`),
    INDEX `transfers_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transfer_lines` (
    `id` VARCHAR(191) NOT NULL,
    `transferId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `fromLocationId` VARCHAR(191) NULL,
    `toLocationId` VARCHAR(191) NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unitPrice` DECIMAL(15, 2) NULL,
    `total` DECIMAL(15, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `transfer_lines_transferId_idx`(`transferId`),
    INDEX `transfer_lines_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assemblies` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `assemblies_companyId_idx`(`companyId`),
    INDEX `assemblies_branchId_idx`(`branchId`),
    INDEX `assemblies_warehouseId_idx`(`warehouseId`),
    INDEX `assemblies_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assembly_lines` (
    `id` VARCHAR(191) NOT NULL,
    `assemblyId` VARCHAR(191) NOT NULL,
    `assembledItemId` VARCHAR(191) NOT NULL,
    `assembledQuantity` DECIMAL(15, 3) NOT NULL,
    `assembledUnitPrice` DECIMAL(15, 2) NULL,
    `assembledTotal` DECIMAL(15, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `assembly_lines_assemblyId_idx`(`assemblyId`),
    INDEX `assembly_lines_assembledItemId_idx`(`assembledItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assembly_components` (
    `id` VARCHAR(191) NOT NULL,
    `assemblyLineId` VARCHAR(191) NOT NULL,
    `componentItemId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unitPrice` DECIMAL(15, 2) NULL,
    `total` DECIMAL(15, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `assembly_components_assemblyLineId_idx`(`assemblyLineId`),
    INDEX `assembly_components_componentItemId_idx`(`componentItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `disassemblies` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `disassemblies_companyId_idx`(`companyId`),
    INDEX `disassemblies_branchId_idx`(`branchId`),
    INDEX `disassemblies_warehouseId_idx`(`warehouseId`),
    INDEX `disassemblies_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `disassembly_lines` (
    `id` VARCHAR(191) NOT NULL,
    `disassemblyId` VARCHAR(191) NOT NULL,
    `disassembledItemId` VARCHAR(191) NOT NULL,
    `disassembledQuantity` DECIMAL(15, 3) NOT NULL,
    `disassembledUnitPrice` DECIMAL(15, 2) NULL,
    `disassembledTotal` DECIMAL(15, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `disassembly_lines_disassemblyId_idx`(`disassemblyId`),
    INDEX `disassembly_lines_disassembledItemId_idx`(`disassembledItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `disassembly_components` (
    `id` VARCHAR(191) NOT NULL,
    `disassemblyLineId` VARCHAR(191) NOT NULL,
    `componentItemId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unitPrice` DECIMAL(15, 2) NULL,
    `total` DECIMAL(15, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `disassembly_components_disassemblyLineId_idx`(`disassemblyLineId`),
    INDEX `disassembly_components_componentItemId_idx`(`componentItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receipts` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `receipts_companyId_idx`(`companyId`),
    INDEX `receipts_branchId_idx`(`branchId`),
    INDEX `receipts_warehouseId_idx`(`warehouseId`),
    INDEX `receipts_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receipt_lines` (
    `id` VARCHAR(191) NOT NULL,
    `receiptId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unitPrice` DECIMAL(15, 2) NULL,
    `total` DECIMAL(15, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `receipt_lines_receiptId_idx`(`receiptId`),
    INDEX `receipt_lines_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `issues` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `issues_companyId_idx`(`companyId`),
    INDEX `issues_branchId_idx`(`branchId`),
    INDEX `issues_warehouseId_idx`(`warehouseId`),
    INDEX `issues_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `issue_lines` (
    `id` VARCHAR(191) NOT NULL,
    `issueId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unitPrice` DECIMAL(15, 2) NULL,
    `total` DECIMAL(15, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `issue_lines_issueId_idx`(`issueId`),
    INDEX `issue_lines_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adjustments` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `adjustments_companyId_idx`(`companyId`),
    INDEX `adjustments_branchId_idx`(`branchId`),
    INDEX `adjustments_warehouseId_idx`(`warehouseId`),
    INDEX `adjustments_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adjustment_lines` (
    `id` VARCHAR(191) NOT NULL,
    `adjustmentId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `bookQuantity` DECIMAL(15, 3) NOT NULL,
    `actualQuantity` DECIMAL(15, 3) NOT NULL,
    `adjustmentQuantity` DECIMAL(15, 3) NOT NULL,
    `unitPrice` DECIMAL(15, 2) NULL,
    `adjustmentTotal` DECIMAL(15, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `adjustment_lines_adjustmentId_idx`(`adjustmentId`),
    INDEX `adjustment_lines_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `other_adjustments` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `other_adjustments_companyId_idx`(`companyId`),
    INDEX `other_adjustments_branchId_idx`(`branchId`),
    INDEX `other_adjustments_warehouseId_idx`(`warehouseId`),
    INDEX `other_adjustments_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `other_adjustment_lines` (
    `id` VARCHAR(191) NOT NULL,
    `otherAdjustmentId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `adjustmentType` VARCHAR(191) NOT NULL,
    `unitPrice` DECIMAL(15, 2) NULL,
    `total` DECIMAL(15, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `other_adjustment_lines_otherAdjustmentId_idx`(`otherAdjustmentId`),
    INDEX `other_adjustment_lines_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `other_adjustment_sources` (
    `id` VARCHAR(191) NOT NULL,
    `otherAdjustmentLineId` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `percentage` DECIMAL(5, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `other_adjustment_sources_otherAdjustmentLineId_idx`(`otherAdjustmentLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_orders` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NULL,
    `orderNumber` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NULL,
    `currencyId` VARCHAR(191) NULL,
    `exchangeRate` DECIMAL(15, 4) NULL,
    `expectedDeliveryDate` DATETIME(3) NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalDiscount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalTax` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `netAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `cancelledAt` DATETIME(3) NULL,
    `invoiceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `purchase_orders_companyId_idx`(`companyId`),
    INDEX `purchase_orders_branchId_idx`(`branchId`),
    INDEX `purchase_orders_supplierId_idx`(`supplierId`),
    INDEX `purchase_orders_warehouseId_idx`(`warehouseId`),
    INDEX `purchase_orders_date_idx`(`date`),
    UNIQUE INDEX `purchase_orders_invoiceId_key`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_lines` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NULL,
    `baseUnitId` VARCHAR(191) NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `baseQuantity` DECIMAL(15, 3) NULL,
    `unitPrice` DECIMAL(15, 2) NULL,
    `total` DECIMAL(15, 2) NULL,
    `discountPercentage` DECIMAL(5, 2) NULL,
    `discountValue` DECIMAL(15, 2) NULL,
    `taxPercentage` DECIMAL(5, 2) NULL,
    `taxValue` DECIMAL(15, 2) NULL,
    `netTotal` DECIMAL(15, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `purchase_order_lines_purchaseOrderId_idx`(`purchaseOrderId`),
    INDEX `purchase_order_lines_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_conditions` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `condition` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `purchase_order_conditions_purchaseOrderId_idx`(`purchaseOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_returns` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NULL,
    `returnNumber` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `originalInvoiceId` VARCHAR(191) NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `currencyId` VARCHAR(191) NULL,
    `exchangeRate` DECIMAL(15, 4) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `costCenterId` VARCHAR(191) NULL,
    `delegateId` VARCHAR(191) NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalDiscount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalTax` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `netAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `purchase_returns_companyId_idx`(`companyId`),
    INDEX `purchase_returns_branchId_idx`(`branchId`),
    INDEX `purchase_returns_supplierId_idx`(`supplierId`),
    INDEX `purchase_returns_warehouseId_idx`(`warehouseId`),
    INDEX `purchase_returns_originalInvoiceId_idx`(`originalInvoiceId`),
    INDEX `purchase_returns_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_return_lines` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseReturnId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `baseQuantity` DECIMAL(15, 3) NOT NULL,
    `unitPrice` DECIMAL(15, 2) NOT NULL,
    `total` DECIMAL(15, 2) NOT NULL,
    `discountPercentage` DECIMAL(5, 2) NULL,
    `discountValue` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `taxPercentage` DECIMAL(5, 2) NULL,
    `taxValue` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `netTotal` DECIMAL(15, 2) NOT NULL,
    `originalInvoiceLineId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `purchase_return_lines_purchaseReturnId_idx`(`purchaseReturnId`),
    INDEX `purchase_return_lines_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_quotes` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NULL,
    `quoteNumber` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NULL,
    `currencyId` VARCHAR(191) NULL,
    `exchangeRate` DECIMAL(15, 4) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `isSalesTaxInvoice` BOOLEAN NOT NULL DEFAULT false,
    `delegateId` VARCHAR(191) NULL,
    `costCenterId` VARCHAR(191) NULL,
    `validUntil` DATETIME(3) NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalDiscount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalTax` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `netAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `cancelledAt` DATETIME(3) NULL,
    `isConverted` BOOLEAN NOT NULL DEFAULT false,
    `convertedAt` DATETIME(3) NULL,
    `invoiceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `price_quotes_companyId_idx`(`companyId`),
    INDEX `price_quotes_branchId_idx`(`branchId`),
    INDEX `price_quotes_customerId_idx`(`customerId`),
    INDEX `price_quotes_warehouseId_idx`(`warehouseId`),
    INDEX `price_quotes_date_idx`(`date`),
    UNIQUE INDEX `price_quotes_invoiceId_key`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_quote_lines` (
    `id` VARCHAR(191) NOT NULL,
    `priceQuoteId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `baseUnitId` VARCHAR(191) NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `baseQuantity` DECIMAL(15, 3) NOT NULL,
    `unitPrice` DECIMAL(15, 2) NOT NULL,
    `total` DECIMAL(15, 2) NOT NULL,
    `discountPercentage` DECIMAL(5, 2) NULL,
    `discountValue` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `taxPercentage` DECIMAL(5, 2) NULL,
    `taxValue` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `netTotal` DECIMAL(15, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `price_quote_lines_priceQuoteId_idx`(`priceQuoteId`),
    INDEX `price_quote_lines_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_quote_conditions` (
    `id` VARCHAR(191) NOT NULL,
    `priceQuoteId` VARCHAR(191) NOT NULL,
    `condition` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `price_quote_conditions_priceQuoteId_idx`(`priceQuoteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_offers` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NULL,
    `how` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `fromItemId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `percentage` DECIMAL(5, 2) NULL,
    `offerQuantity` DECIMAL(15, 3) NULL,
    `toItemId` VARCHAR(191) NULL,
    `invoiceValue` DECIMAL(15, 2) NULL,
    `supplierId` VARCHAR(191) NULL,
    `unitId` VARCHAR(191) NULL,
    `fromDate` DATETIME(3) NOT NULL,
    `toDate` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `item_offers_companyId_idx`(`companyId`),
    INDEX `item_offers_branchId_idx`(`branchId`),
    INDEX `item_offers_fromItemId_idx`(`fromItemId`),
    INDEX `item_offers_toItemId_idx`(`toItemId`),
    INDEX `item_offers_type_idx`(`type`),
    INDEX `item_offers_how_idx`(`how`),
    INDEX `item_offers_source_idx`(`source`),
    INDEX `item_offers_fromDate_idx`(`fromDate`),
    INDEX `item_offers_toDate_idx`(`toDate`),
    INDEX `item_offers_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NULL,
    `invoiceType` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `hijriDate` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `currencyCode` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `supplierId` VARCHAR(191) NULL,
    `warehouseId` VARCHAR(191) NULL,
    `costCenterId` VARCHAR(191) NULL,
    `representativeId` VARCHAR(191) NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `netAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `paidAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `remainingAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `isSalesTaxInvoice` BOOLEAN NOT NULL DEFAULT false,
    `allowReturn` BOOLEAN NOT NULL DEFAULT false,
    `returnDays` INTEGER NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `sellerId` VARCHAR(191) NULL,
    `currencyId` VARCHAR(191) NULL,
    `taxSignature` TEXT NULL,
    `taxHash` VARCHAR(191) NULL,
    `taxSubmitted` BOOLEAN NOT NULL DEFAULT false,
    `taxSubmissionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `invoices_companyId_date_idx`(`companyId`, `date`),
    INDEX `invoices_invoiceNumber_idx`(`invoiceNumber`),
    INDEX `invoices_invoiceType_idx`(`invoiceType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_lines` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `baseQuantity` DECIMAL(15, 3) NOT NULL,
    `price` DECIMAL(15, 2) NOT NULL,
    `total` DECIMAL(15, 2) NOT NULL,
    `discountPercent` DECIMAL(5, 2) NULL,
    `discountAmount` DECIMAL(15, 2) NULL,
    `taxPercent` DECIMAL(5, 2) NULL,
    `taxAmount` DECIMAL(15, 2) NULL,
    `lineOrder` INTEGER NOT NULL,

    INDEX `invoice_lines_invoiceId_idx`(`invoiceId`),
    INDEX `invoice_lines_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `serial` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `nationalityId` VARCHAR(191) NULL,
    `religionId` VARCHAR(191) NULL,
    `maritalStatusId` VARCHAR(191) NULL,
    `birthDate` DATETIME(3) NULL,
    `academicQualification` VARCHAR(191) NULL,
    `specialization` VARCHAR(191) NULL,
    `university` VARCHAR(191) NULL,
    `passportNumber` VARCHAR(191) NULL,
    `insurancePolicyNumber` VARCHAR(191) NULL,
    `socialInsurance` VARCHAR(191) NULL,
    `advanceAccountId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `employees_companyId_idx`(`companyId`),
    INDEX `employees_serial_idx`(`serial`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_contracts` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `serial` VARCHAR(191) NULL,
    `contractStartDate` DATETIME(3) NOT NULL,
    `contractEndDate` DATETIME(3) NULL,
    `wagePolicyId` VARCHAR(191) NULL,
    `basicSalary` DECIMAL(15, 2) NULL,
    `insuranceSalary` DECIMAL(15, 2) NULL,
    `insurancePercentage` DECIMAL(5, 2) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `employeeResponsibility` DECIMAL(15, 2) NULL,
    `companyResponsibility` DECIMAL(15, 2) NULL,
    `leaveBalance` DECIMAL(10, 2) NULL,
    `departmentId` VARCHAR(191) NULL,
    `sectionId` VARCHAR(191) NULL,
    `jobCadreId` VARCHAR(191) NULL,
    `jobTitleId` VARCHAR(191) NULL,
    `cityId` VARCHAR(191) NULL,
    `workBranchId` VARCHAR(191) NULL,
    `salaryBranchId` VARCHAR(191) NULL,
    `costCenterId` VARCHAR(191) NULL,
    `autoRenewal` BOOLEAN NOT NULL DEFAULT false,
    `attendancePolicy` BOOLEAN NOT NULL DEFAULT true,
    `incomeTax` BOOLEAN NOT NULL DEFAULT true,
    `generalNotes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `employee_contracts_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_procedures` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `procedureType` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `description` TEXT NULL,
    `amount` DECIMAL(15, 2) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `employee_procedures_employeeId_idx`(`employeeId`),
    INDEX `employee_procedures_procedureType_idx`(`procedureType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_advances` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `serial` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `hijriDate` VARCHAR(191) NULL,
    `value` DECIMAL(15, 2) NOT NULL,
    `monthlyInstallment` DECIMAL(15, 2) NULL,
    `fromMonth` VARCHAR(191) NULL,
    `toYear` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `record` VARCHAR(191) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `employee_advances_employeeId_idx`(`employeeId`),
    INDEX `employee_advances_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nationalities` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `nationalities_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `religions` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `religions_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `marital_statuses` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `marital_statuses_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_titles` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `job_titles_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_cadres` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `job_cadres_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `managementId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `departments_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cities` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cities_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wage_policies` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wage_policies_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `allowances` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `allowances_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deductions` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `deductions_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `serial` VARCHAR(191) NULL,
    `studentName` VARCHAR(191) NOT NULL,
    `year` VARCHAR(191) NULL,
    `fatherName` VARCHAR(191) NULL,
    `fatherGrandfather` VARCHAR(191) NULL,
    `fatherGreatGrandfather` VARCHAR(191) NULL,
    `motherName` VARCHAR(191) NULL,
    `motherGrandfather` VARCHAR(191) NULL,
    `motherGreatGrandfather` VARCHAR(191) NULL,
    `currencyCode` VARCHAR(191) NULL,
    `stageId` VARCHAR(191) NULL,
    `semesterId` VARCHAR(191) NULL,
    `paymentType` VARCHAR(191) NULL,
    `enrollment` VARCHAR(191) NULL,
    `isFinished` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `students_companyId_idx`(`companyId`),
    INDEX `students_serial_idx`(`serial`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_installments` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `installment` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `value` DECIMAL(15, 2) NOT NULL,
    `carValue` DECIMAL(15, 2) NULL,
    `educationDiscount` DECIMAL(15, 2) NULL,
    `carDiscount` DECIMAL(15, 2) NULL,
    `total` DECIMAL(15, 2) NOT NULL,
    `isPaid` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `student_installments_studentId_idx`(`studentId`),
    INDEX `student_installments_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stages` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stages_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `semesters` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `arabicName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `semesters_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users_legacy` ADD CONSTRAINT `users_legacy_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_settings` ADD CONSTRAINT `company_settings_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_branch_permissions` ADD CONSTRAINT `user_branch_permissions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_branch_permissions` ADD CONSTRAINT `user_branch_permissions_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_groups` ADD CONSTRAINT `user_groups_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_group_members` ADD CONSTRAINT `user_group_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_group_members` ADD CONSTRAINT `user_group_members_userGroupId_fkey` FOREIGN KEY (`userGroupId`) REFERENCES `user_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_advanced_permissions` ADD CONSTRAINT `user_advanced_permissions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cost_centers` ADD CONSTRAINT `cost_centers_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cost_center_movements` ADD CONSTRAINT `cost_center_movements_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cost_center_movements` ADD CONSTRAINT `cost_center_movements_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cost_center_movements` ADD CONSTRAINT `cost_center_movements_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entry_lines` ADD CONSTRAINT `journal_entry_lines_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entry_lines` ADD CONSTRAINT `journal_entry_lines_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entry_lines` ADD CONSTRAINT `journal_entry_lines_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_mainAccountId_fkey` FOREIGN KEY (`mainAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_mainAccountId_fkey` FOREIGN KEY (`mainAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delegates` ADD CONSTRAINT `delegates_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `currencies` ADD CONSTRAINT `currencies_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `periods` ADD CONSTRAINT `periods_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `banks` ADD CONSTRAINT `banks_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_bankId_fkey` FOREIGN KEY (`bankId`) REFERENCES `banks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `safes` ADD CONSTRAINT `safes_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_safeId_fkey` FOREIGN KEY (`safeId`) REFERENCES `safes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_bankId_fkey` FOREIGN KEY (`bankId`) REFERENCES `banks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_safeId_fkey` FOREIGN KEY (`safeId`) REFERENCES `safes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_bankId_fkey` FOREIGN KEY (`bankId`) REFERENCES `banks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `securities_receipts` ADD CONSTRAINT `securities_receipts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `securities_receipts` ADD CONSTRAINT `securities_receipts_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `securities_receipts` ADD CONSTRAINT `securities_receipts_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `securities_payments` ADD CONSTRAINT `securities_payments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `securities_payments` ADD CONSTRAINT `securities_payments_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `securities_payments` ADD CONSTRAINT `securities_payments_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `securities_renewals` ADD CONSTRAINT `securities_renewals_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_units` ADD CONSTRAINT `item_units_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_units` ADD CONSTRAINT `item_units_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_lists` ADD CONSTRAINT `price_lists_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_prices` ADD CONSTRAINT `item_prices_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_prices` ADD CONSTRAINT `item_prices_priceListId_fkey` FOREIGN KEY (`priceListId`) REFERENCES `price_lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_prices` ADD CONSTRAINT `item_prices_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warehouses` ADD CONSTRAINT `warehouses_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warehouses` ADD CONSTRAINT `warehouses_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `locations` ADD CONSTRAINT `locations_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_quantities` ADD CONSTRAINT `item_quantities_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_quantities` ADD CONSTRAINT `item_quantities_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_quantities` ADD CONSTRAINT `item_quantities_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opening_stocks` ADD CONSTRAINT `opening_stocks_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opening_stock_lines` ADD CONSTRAINT `opening_stock_lines_openingStockId_fkey` FOREIGN KEY (`openingStockId`) REFERENCES `opening_stocks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opening_stock_lines` ADD CONSTRAINT `opening_stock_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opening_stock_lines` ADD CONSTRAINT `opening_stock_lines_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opening_stock_lines` ADD CONSTRAINT `opening_stock_lines_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stocktaking` ADD CONSTRAINT `stocktaking_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stocktaking` ADD CONSTRAINT `stocktaking_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stocktaking_lines` ADD CONSTRAINT `stocktaking_lines_stocktakingId_fkey` FOREIGN KEY (`stocktakingId`) REFERENCES `stocktaking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stocktaking_lines` ADD CONSTRAINT `stocktaking_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stocktaking_lines` ADD CONSTRAINT `stocktaking_lines_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stocktaking_lines` ADD CONSTRAINT `stocktaking_lines_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stocktaking_lines` ADD CONSTRAINT `stocktaking_lines_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_fromWarehouseId_fkey` FOREIGN KEY (`fromWarehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_toWarehouseId_fkey` FOREIGN KEY (`toWarehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_fromCostCenterId_fkey` FOREIGN KEY (`fromCostCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_toCostCenterId_fkey` FOREIGN KEY (`toCostCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_lines` ADD CONSTRAINT `transfer_lines_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `transfers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_lines` ADD CONSTRAINT `transfer_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_lines` ADD CONSTRAINT `transfer_lines_fromLocationId_fkey` FOREIGN KEY (`fromLocationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_lines` ADD CONSTRAINT `transfer_lines_toLocationId_fkey` FOREIGN KEY (`toLocationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assemblies` ADD CONSTRAINT `assemblies_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assemblies` ADD CONSTRAINT `assemblies_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assembly_lines` ADD CONSTRAINT `assembly_lines_assemblyId_fkey` FOREIGN KEY (`assemblyId`) REFERENCES `assemblies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assembly_lines` ADD CONSTRAINT `assembly_lines_assembledItemId_fkey` FOREIGN KEY (`assembledItemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assembly_components` ADD CONSTRAINT `assembly_components_assemblyLineId_fkey` FOREIGN KEY (`assemblyLineId`) REFERENCES `assembly_lines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assembly_components` ADD CONSTRAINT `assembly_components_componentItemId_fkey` FOREIGN KEY (`componentItemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `disassemblies` ADD CONSTRAINT `disassemblies_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `disassemblies` ADD CONSTRAINT `disassemblies_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `disassembly_lines` ADD CONSTRAINT `disassembly_lines_disassemblyId_fkey` FOREIGN KEY (`disassemblyId`) REFERENCES `disassemblies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `disassembly_lines` ADD CONSTRAINT `disassembly_lines_disassembledItemId_fkey` FOREIGN KEY (`disassembledItemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `disassembly_components` ADD CONSTRAINT `disassembly_components_disassemblyLineId_fkey` FOREIGN KEY (`disassemblyLineId`) REFERENCES `disassembly_lines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `disassembly_components` ADD CONSTRAINT `disassembly_components_componentItemId_fkey` FOREIGN KEY (`componentItemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipts` ADD CONSTRAINT `receipts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipts` ADD CONSTRAINT `receipts_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt_lines` ADD CONSTRAINT `receipt_lines_receiptId_fkey` FOREIGN KEY (`receiptId`) REFERENCES `receipts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt_lines` ADD CONSTRAINT `receipt_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt_lines` ADD CONSTRAINT `receipt_lines_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issues` ADD CONSTRAINT `issues_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issues` ADD CONSTRAINT `issues_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issue_lines` ADD CONSTRAINT `issue_lines_issueId_fkey` FOREIGN KEY (`issueId`) REFERENCES `issues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issue_lines` ADD CONSTRAINT `issue_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issue_lines` ADD CONSTRAINT `issue_lines_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adjustments` ADD CONSTRAINT `adjustments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adjustments` ADD CONSTRAINT `adjustments_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adjustment_lines` ADD CONSTRAINT `adjustment_lines_adjustmentId_fkey` FOREIGN KEY (`adjustmentId`) REFERENCES `adjustments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adjustment_lines` ADD CONSTRAINT `adjustment_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adjustment_lines` ADD CONSTRAINT `adjustment_lines_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `other_adjustments` ADD CONSTRAINT `other_adjustments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `other_adjustments` ADD CONSTRAINT `other_adjustments_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `other_adjustment_lines` ADD CONSTRAINT `other_adjustment_lines_otherAdjustmentId_fkey` FOREIGN KEY (`otherAdjustmentId`) REFERENCES `other_adjustments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `other_adjustment_lines` ADD CONSTRAINT `other_adjustment_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `other_adjustment_lines` ADD CONSTRAINT `other_adjustment_lines_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `other_adjustment_sources` ADD CONSTRAINT `other_adjustment_sources_otherAdjustmentLineId_fkey` FOREIGN KEY (`otherAdjustmentLineId`) REFERENCES `other_adjustment_lines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_currencyId_fkey` FOREIGN KEY (`currencyId`) REFERENCES `currencies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_baseUnitId_fkey` FOREIGN KEY (`baseUnitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_conditions` ADD CONSTRAINT `purchase_order_conditions_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_currencyId_fkey` FOREIGN KEY (`currencyId`) REFERENCES `currencies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_originalInvoiceId_fkey` FOREIGN KEY (`originalInvoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_delegateId_fkey` FOREIGN KEY (`delegateId`) REFERENCES `delegates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_return_lines` ADD CONSTRAINT `purchase_return_lines_purchaseReturnId_fkey` FOREIGN KEY (`purchaseReturnId`) REFERENCES `purchase_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_return_lines` ADD CONSTRAINT `purchase_return_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_return_lines` ADD CONSTRAINT `purchase_return_lines_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_return_lines` ADD CONSTRAINT `purchase_return_lines_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_quotes` ADD CONSTRAINT `price_quotes_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_quotes` ADD CONSTRAINT `price_quotes_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_quotes` ADD CONSTRAINT `price_quotes_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_quotes` ADD CONSTRAINT `price_quotes_currencyId_fkey` FOREIGN KEY (`currencyId`) REFERENCES `currencies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_quotes` ADD CONSTRAINT `price_quotes_delegateId_fkey` FOREIGN KEY (`delegateId`) REFERENCES `delegates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_quotes` ADD CONSTRAINT `price_quotes_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_quotes` ADD CONSTRAINT `price_quotes_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_quote_lines` ADD CONSTRAINT `price_quote_lines_priceQuoteId_fkey` FOREIGN KEY (`priceQuoteId`) REFERENCES `price_quotes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_quote_lines` ADD CONSTRAINT `price_quote_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_quote_lines` ADD CONSTRAINT `price_quote_lines_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_quote_lines` ADD CONSTRAINT `price_quote_lines_baseUnitId_fkey` FOREIGN KEY (`baseUnitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_quote_conditions` ADD CONSTRAINT `price_quote_conditions_priceQuoteId_fkey` FOREIGN KEY (`priceQuoteId`) REFERENCES `price_quotes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_offers` ADD CONSTRAINT `item_offers_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_offers` ADD CONSTRAINT `item_offers_fromItemId_fkey` FOREIGN KEY (`fromItemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_offers` ADD CONSTRAINT `item_offers_toItemId_fkey` FOREIGN KEY (`toItemId`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_offers` ADD CONSTRAINT `item_offers_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_offers` ADD CONSTRAINT `item_offers_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_representativeId_fkey` FOREIGN KEY (`representativeId`) REFERENCES `delegates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_currencyId_fkey` FOREIGN KEY (`currencyId`) REFERENCES `currencies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_lines` ADD CONSTRAINT `invoice_lines_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_lines` ADD CONSTRAINT `invoice_lines_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_lines` ADD CONSTRAINT `invoice_lines_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_nationalityId_fkey` FOREIGN KEY (`nationalityId`) REFERENCES `nationalities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_religionId_fkey` FOREIGN KEY (`religionId`) REFERENCES `religions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_maritalStatusId_fkey` FOREIGN KEY (`maritalStatusId`) REFERENCES `marital_statuses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_advanceAccountId_fkey` FOREIGN KEY (`advanceAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_contracts` ADD CONSTRAINT `employee_contracts_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_contracts` ADD CONSTRAINT `employee_contracts_wagePolicyId_fkey` FOREIGN KEY (`wagePolicyId`) REFERENCES `wage_policies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_contracts` ADD CONSTRAINT `employee_contracts_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_contracts` ADD CONSTRAINT `employee_contracts_jobTitleId_fkey` FOREIGN KEY (`jobTitleId`) REFERENCES `job_titles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_contracts` ADD CONSTRAINT `employee_contracts_jobCadreId_fkey` FOREIGN KEY (`jobCadreId`) REFERENCES `job_cadres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_contracts` ADD CONSTRAINT `employee_contracts_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_contracts` ADD CONSTRAINT `employee_contracts_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_procedures` ADD CONSTRAINT `employee_procedures_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_advances` ADD CONSTRAINT `employee_advances_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nationalities` ADD CONSTRAINT `nationalities_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `religions` ADD CONSTRAINT `religions_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marital_statuses` ADD CONSTRAINT `marital_statuses_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_titles` ADD CONSTRAINT `job_titles_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_cadres` ADD CONSTRAINT `job_cadres_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cities` ADD CONSTRAINT `cities_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wage_policies` ADD CONSTRAINT `wage_policies_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `allowances` ADD CONSTRAINT `allowances_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deductions` ADD CONSTRAINT `deductions_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `stages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_semesterId_fkey` FOREIGN KEY (`semesterId`) REFERENCES `semesters`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_installments` ADD CONSTRAINT `student_installments_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stages` ADD CONSTRAINT `stages_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `semesters` ADD CONSTRAINT `semesters_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
