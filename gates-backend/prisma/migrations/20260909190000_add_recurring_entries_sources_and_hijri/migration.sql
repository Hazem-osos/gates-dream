-- Recurring journal templates + journal sourceKind/isRecurring.
-- hijriDate already exists on journal_entries / invoices / cash_transactions.
-- Keep journal_entries.sourceType as VARCHAR (Auto-GL short codes SI/PI/…).

ALTER TABLE `journal_entries`
  ADD COLUMN `isRecurring` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `sourceKind` ENUM(
    'MANUAL',
    'RECURRING_TEMPLATE',
    'SALES_INVOICE',
    'SALES_RETURN',
    'PURCHASE_INVOICE',
    'PURCHASE_RETURN',
    'PAYMENT_VOUCHER',
    'RECEIPT_VOUCHER',
    'STOCK_TRANSACTION',
    'DEPRECIATION',
    'CHEQUE_ENDORSEMENT',
    'CLOSING_ENTRY'
  ) NOT NULL DEFAULT 'MANUAL';

CREATE INDEX `journal_entries_companyId_sourceKind_idx` ON `journal_entries`(`companyId`, `sourceKind`);

UPDATE `journal_entries` SET `sourceKind` = 'SALES_INVOICE' WHERE `sourceType` IN ('SI');
UPDATE `journal_entries` SET `sourceKind` = 'PURCHASE_INVOICE' WHERE `sourceType` IN ('PI');
UPDATE `journal_entries` SET `sourceKind` = 'SALES_RETURN' WHERE `sourceType` IN ('SR');
UPDATE `journal_entries` SET `sourceKind` = 'PURCHASE_RETURN' WHERE `sourceType` IN ('PR');
UPDATE `journal_entries` SET `sourceKind` = 'RECEIPT_VOUCHER' WHERE `sourceType` IN ('CR');
UPDATE `journal_entries` SET `sourceKind` = 'PAYMENT_VOUCHER' WHERE `sourceType` IN ('CP', 'CEP');
UPDATE `journal_entries` SET `sourceKind` = 'CHEQUE_ENDORSEMENT' WHERE `sourceType` IN ('CKE', 'CKC', 'CKB');
UPDATE `journal_entries` SET `sourceKind` = 'RECURRING_TEMPLATE' WHERE `sourceType` IN ('RECURRING_TEMPLATE');

CREATE TABLE `recurring_journal_entries` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `templateNameAr` VARCHAR(191) NOT NULL,
    `frequency` ENUM('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
    `notes` TEXT NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastGeneratedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `recurring_journal_entries_companyId_isActive_idx`(`companyId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `recurring_journal_lines` (
    `id` VARCHAR(191) NOT NULL,
    `recurringEntryId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `costCenterId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `debit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `credit` DECIMAL(15, 2) NOT NULL DEFAULT 0,

    INDEX `recurring_journal_lines_recurringEntryId_idx`(`recurringEntryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `recurring_journal_entries`
  ADD CONSTRAINT `recurring_journal_entries_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `recurring_journal_lines`
  ADD CONSTRAINT `recurring_journal_lines_recurringEntryId_fkey`
  FOREIGN KEY (`recurringEntryId`) REFERENCES `recurring_journal_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `recurring_journal_lines`
  ADD CONSTRAINT `recurring_journal_lines_accountId_fkey`
  FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `recurring_journal_lines`
  ADD CONSTRAINT `recurring_journal_lines_costCenterId_fkey`
  FOREIGN KEY (`costCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
