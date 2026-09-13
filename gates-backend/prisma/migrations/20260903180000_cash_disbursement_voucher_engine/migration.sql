-- AlterTable
ALTER TABLE `cash_transactions`
    ADD COLUMN `hijriDate` VARCHAR(191) NULL,
    ADD COLUMN `isRecurring` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `documentRole` VARCHAR(20) NOT NULL DEFAULT 'VOUCHER',
    ADD COLUMN `departmentId` VARCHAR(191) NULL,
    ADD COLUMN `sourceOrderId` VARCHAR(191) NULL,
    ADD COLUMN `workflowStatus` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN `approvalState` JSON NULL;

CREATE INDEX `cash_transactions_departmentId_idx` ON `cash_transactions`(`departmentId`);
CREATE INDEX `cash_transactions_sourceOrderId_idx` ON `cash_transactions`(`sourceOrderId`);
CREATE INDEX `cash_transactions_companyId_documentRole_transactionKind_idx` ON `cash_transactions`(`companyId`, `documentRole`, `transactionKind`);
CREATE INDEX `cash_transactions_companyId_isRecurring_idx` ON `cash_transactions`(`companyId`, `isRecurring`);

ALTER TABLE `cash_transactions`
    ADD CONSTRAINT `cash_transactions_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `cash_transactions_sourceOrderId_fkey` FOREIGN KEY (`sourceOrderId`) REFERENCES `cash_transactions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `cash_transaction_lines` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `cashTransactionId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `currencyCode` VARCHAR(191) NOT NULL,
    `exchangeRate` DECIMAL(18, 6) NOT NULL DEFAULT 1,
    `costCenterId` VARCHAR(191) NULL,
    `lineOrder` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cash_transaction_lines_companyId_idx`(`companyId`),
    INDEX `cash_transaction_lines_cashTransactionId_idx`(`cashTransactionId`),
    INDEX `cash_transaction_lines_accountId_idx`(`accountId`),
    INDEX `cash_transaction_lines_costCenterId_idx`(`costCenterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `cash_transaction_lines`
    ADD CONSTRAINT `cash_transaction_lines_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `cash_transaction_lines_cashTransactionId_fkey` FOREIGN KEY (`cashTransactionId`) REFERENCES `cash_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `cash_transaction_lines_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `cash_transaction_lines_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `exchange_rate_histories` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `currencyCode` VARCHAR(191) NOT NULL,
    `rate` DECIMAL(18, 6) NOT NULL,
    `sourceType` VARCHAR(40) NOT NULL,
    `sourceId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `exchange_rate_histories_companyId_currencyCode_recordedAt_idx`(`companyId`, `currencyCode`, `recordedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `exchange_rate_histories`
    ADD CONSTRAINT `exchange_rate_histories_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
