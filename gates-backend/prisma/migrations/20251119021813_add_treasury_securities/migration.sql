-- Migration: Add Treasury and Securities Modules (MySQL)
-- This migration creates tables for Treasury operations (Banks, Safes, Receipts, Payments) and Securities operations

-- ============================================
-- TREASURY MODULE TABLES
-- ============================================

-- Create Banks table
CREATE TABLE IF NOT EXISTS `banks` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `code` VARCHAR(255) NULL,
    `arabicName` VARCHAR(255) NOT NULL,
    `englishName` VARCHAR(255) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    UNIQUE KEY `banks_companyId_code_key` (`companyId`, `code`),
    KEY `banks_companyId_idx` (`companyId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Bank Accounts table
CREATE TABLE IF NOT EXISTS `bank_accounts` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `bankId` CHAR(36) NOT NULL,
    `code` VARCHAR(255) NULL,
    `arabicName` VARCHAR(255) NOT NULL,
    `englishName` VARCHAR(255) NULL,
    `accountNumber` VARCHAR(255) NULL,
    `iban` VARCHAR(255) NULL,
    `currencyCode` VARCHAR(255) NOT NULL,
    `balance` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    UNIQUE KEY `bank_accounts_companyId_code_key` (`companyId`, `code`),
    KEY `bank_accounts_companyId_bankId_idx` (`companyId`, `bankId`),
    KEY `bank_accounts_bankId_fkey` (`bankId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Safes table
CREATE TABLE IF NOT EXISTS `safes` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `code` VARCHAR(255) NULL,
    `arabicName` VARCHAR(255) NOT NULL,
    `englishName` VARCHAR(255) NULL,
    `currencyCode` VARCHAR(255) NOT NULL,
    `balance` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    UNIQUE KEY `safes_companyId_code_key` (`companyId`, `code`),
    KEY `safes_companyId_idx` (`companyId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Treasury Receipts table
CREATE TABLE IF NOT EXISTS `treasury_receipts` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `branchId` CHAR(36) NULL,
    `serial` VARCHAR(255) NULL,
    `voucherNumber` VARCHAR(255) NULL,
    `date` DATETIME(3) NOT NULL,
    `hijriDate` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `receiptType` VARCHAR(255) NOT NULL,
    `customerId` CHAR(36) NULL,
    `supplierId` CHAR(36) NULL,
    `accountId` CHAR(36) NULL,
    `safeId` CHAR(36) NULL,
    `bankAccountId` CHAR(36) NULL,
    `amount` DECIMAL(15,2) NOT NULL,
    `currencyCode` VARCHAR(255) NOT NULL,
    `exchangeRate` DECIMAL(15,6) NULL,
    `isPosted` BOOLEAN NOT NULL DEFAULT FALSE,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT FALSE,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT FALSE,
    `cancelledAt` DATETIME(3) NULL,
    `journalEntryId` CHAR(36) NULL,
    `bankId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    UNIQUE KEY `treasury_receipts_companyId_voucherNumber_key` (`companyId`, `voucherNumber`),
    KEY `treasury_receipts_companyId_date_idx` (`companyId`, `date`),
    KEY `treasury_receipts_voucherNumber_idx` (`voucherNumber`),
    KEY `treasury_receipts_receiptType_idx` (`receiptType`),
    KEY `treasury_receipts_customerId_fkey` (`customerId`),
    KEY `treasury_receipts_supplierId_fkey` (`supplierId`),
    KEY `treasury_receipts_accountId_fkey` (`accountId`),
    KEY `treasury_receipts_safeId_fkey` (`safeId`),
    KEY `treasury_receipts_bankAccountId_fkey` (`bankAccountId`),
    KEY `treasury_receipts_journalEntryId_fkey` (`journalEntryId`),
    KEY `treasury_receipts_bankId_fkey` (`bankId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Treasury Payments table
CREATE TABLE IF NOT EXISTS `treasury_payments` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `branchId` CHAR(36) NULL,
    `serial` VARCHAR(255) NULL,
    `voucherNumber` VARCHAR(255) NULL,
    `date` DATETIME(3) NOT NULL,
    `hijriDate` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `paymentType` VARCHAR(255) NOT NULL,
    `safeId` CHAR(36) NULL,
    `bankAccountId` CHAR(36) NULL,
    `accountId` CHAR(36) NULL,
    `customerId` CHAR(36) NULL,
    `supplierId` CHAR(36) NULL,
    `amount` DECIMAL(15,2) NOT NULL,
    `currencyCode` VARCHAR(255) NOT NULL,
    `exchangeRate` DECIMAL(15,6) NULL,
    `isPosted` BOOLEAN NOT NULL DEFAULT FALSE,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT FALSE,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT FALSE,
    `cancelledAt` DATETIME(3) NULL,
    `journalEntryId` CHAR(36) NULL,
    `bankId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    UNIQUE KEY `treasury_payments_companyId_voucherNumber_key` (`companyId`, `voucherNumber`),
    KEY `treasury_payments_companyId_date_idx` (`companyId`, `date`),
    KEY `treasury_payments_voucherNumber_idx` (`voucherNumber`),
    KEY `treasury_payments_paymentType_idx` (`paymentType`),
    KEY `treasury_payments_customerId_fkey` (`customerId`),
    KEY `treasury_payments_supplierId_fkey` (`supplierId`),
    KEY `treasury_payments_accountId_fkey` (`accountId`),
    KEY `treasury_payments_safeId_fkey` (`safeId`),
    KEY `treasury_payments_bankAccountId_fkey` (`bankAccountId`),
    KEY `treasury_payments_journalEntryId_fkey` (`journalEntryId`),
    KEY `treasury_payments_bankId_fkey` (`bankId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SECURITIES MODULE TABLES
-- ============================================

-- Create Securities Receipts table
CREATE TABLE IF NOT EXISTS `securities_receipts` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `branchId` CHAR(36) NULL,
    `serial` VARCHAR(255) NULL,
    `receiptNumber` VARCHAR(255) NULL,
    `date` DATETIME(3) NOT NULL,
    `hijriDate` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `securityType` VARCHAR(255) NOT NULL,
    `customerId` CHAR(36) NULL,
    `supplierId` CHAR(36) NULL,
    `issuerName` VARCHAR(255) NULL,
    `issuerBank` VARCHAR(255) NULL,
    `securityNumber` VARCHAR(255) NULL,
    `dueDate` DATETIME(3) NULL,
    `amount` DECIMAL(15,2) NOT NULL,
    `currencyCode` VARCHAR(255) NOT NULL,
    `isReceived` BOOLEAN NOT NULL DEFAULT TRUE,
    `isPosted` BOOLEAN NOT NULL DEFAULT FALSE,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT FALSE,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT FALSE,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    UNIQUE KEY `securities_receipts_companyId_receiptNumber_key` (`companyId`, `receiptNumber`),
    KEY `securities_receipts_companyId_date_idx` (`companyId`, `date`),
    KEY `securities_receipts_receiptNumber_idx` (`receiptNumber`),
    KEY `securities_receipts_securityType_idx` (`securityType`),
    KEY `securities_receipts_customerId_fkey` (`customerId`),
    KEY `securities_receipts_supplierId_fkey` (`supplierId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Securities Payments table
CREATE TABLE IF NOT EXISTS `securities_payments` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `branchId` CHAR(36) NULL,
    `serial` VARCHAR(255) NULL,
    `paymentNumber` VARCHAR(255) NULL,
    `date` DATETIME(3) NOT NULL,
    `hijriDate` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `securityType` VARCHAR(255) NOT NULL,
    `customerId` CHAR(36) NULL,
    `supplierId` CHAR(36) NULL,
    `payeeName` VARCHAR(255) NULL,
    `payeeBank` VARCHAR(255) NULL,
    `securityNumber` VARCHAR(255) NULL,
    `dueDate` DATETIME(3) NULL,
    `amount` DECIMAL(15,2) NOT NULL,
    `currencyCode` VARCHAR(255) NOT NULL,
    `isPaid` BOOLEAN NOT NULL DEFAULT TRUE,
    `isPosted` BOOLEAN NOT NULL DEFAULT FALSE,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT FALSE,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT FALSE,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    UNIQUE KEY `securities_payments_companyId_paymentNumber_key` (`companyId`, `paymentNumber`),
    KEY `securities_payments_companyId_date_idx` (`companyId`, `date`),
    KEY `securities_payments_paymentNumber_idx` (`paymentNumber`),
    KEY `securities_payments_securityType_idx` (`securityType`),
    KEY `securities_payments_customerId_fkey` (`customerId`),
    KEY `securities_payments_supplierId_fkey` (`supplierId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Securities Renewals table
CREATE TABLE IF NOT EXISTS `securities_renewals` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `branchId` CHAR(36) NULL,
    `serial` VARCHAR(255) NULL,
    `renewalNumber` VARCHAR(255) NULL,
    `date` DATETIME(3) NOT NULL,
    `hijriDate` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `originalSecurityId` VARCHAR(255) NULL,
    `originalSecurityType` VARCHAR(255) NULL,
    `newDueDate` DATETIME(3) NULL,
    `newAmount` DECIMAL(15,2) NULL,
    `renewalFee` DECIMAL(15,2) NULL,
    `isPosted` BOOLEAN NOT NULL DEFAULT FALSE,
    `postedAt` DATETIME(3) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT FALSE,
    `approvedAt` DATETIME(3) NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT FALSE,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    UNIQUE KEY `securities_renewals_companyId_renewalNumber_key` (`companyId`, `renewalNumber`),
    KEY `securities_renewals_companyId_date_idx` (`companyId`, `date`),
    KEY `securities_renewals_renewalNumber_idx` (`renewalNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key constraints (only if referenced tables exist)
-- Note: If base tables (companies, customers, suppliers, accounts, journal_entries) don't exist yet,
-- these foreign keys will fail. Run base migrations first, or add FKs manually later.

-- Uncomment these after base tables are created:
-- ALTER TABLE `banks` ADD CONSTRAINT `banks_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_bankId_fkey` FOREIGN KEY (`bankId`) REFERENCES `banks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE `safes` ADD CONSTRAINT `safes_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_safeId_fkey` FOREIGN KEY (`safeId`) REFERENCES `safes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `treasury_receipts` ADD CONSTRAINT `treasury_receipts_bankId_fkey` FOREIGN KEY (`bankId`) REFERENCES `banks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_safeId_fkey` FOREIGN KEY (`safeId`) REFERENCES `safes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `treasury_payments` ADD CONSTRAINT `treasury_payments_bankId_fkey` FOREIGN KEY (`bankId`) REFERENCES `banks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `securities_receipts` ADD CONSTRAINT `securities_receipts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE `securities_receipts` ADD CONSTRAINT `securities_receipts_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `securities_receipts` ADD CONSTRAINT `securities_receipts_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `securities_payments` ADD CONSTRAINT `securities_payments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE `securities_payments` ADD CONSTRAINT `securities_payments_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `securities_payments` ADD CONSTRAINT `securities_payments_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `securities_renewals` ADD CONSTRAINT `securities_renewals_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
