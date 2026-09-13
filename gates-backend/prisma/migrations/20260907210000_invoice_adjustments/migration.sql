-- Invoice adjustments (additions & deductions) linked to chart of accounts.

CREATE TABLE `invoice_adjustments` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `type` ENUM('ADDITION', 'DEDUCTION') NOT NULL,
    `calcType` ENUM('FIXED', 'PERCENTAGE') NOT NULL DEFAULT 'FIXED',
    `rate` DECIMAL(10, 2) NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `description` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'EGP',
    `accountId` VARCHAR(191) NOT NULL,
    `offsetAccountId` VARCHAR(191) NULL,
    `costCenterId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `invoice_adjustments_companyId_invoiceId_idx`(`companyId`, `invoiceId`),
    INDEX `invoice_adjustments_invoiceId_idx`(`invoiceId`),
    INDEX `invoice_adjustments_accountId_idx`(`accountId`),
    INDEX `invoice_adjustments_offsetAccountId_idx`(`offsetAccountId`),
    INDEX `invoice_adjustments_costCenterId_idx`(`costCenterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `invoice_adjustments`
  ADD CONSTRAINT `invoice_adjustments_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `invoice_adjustments_invoiceId_fkey`
    FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `invoice_adjustments_accountId_fkey`
    FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `invoice_adjustments_offsetAccountId_fkey`
    FOREIGN KEY (`offsetAccountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `invoice_adjustments_costCenterId_fkey`
    FOREIGN KEY (`costCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
