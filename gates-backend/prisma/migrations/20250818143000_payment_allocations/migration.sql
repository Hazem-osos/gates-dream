-- Open-item payment allocations & invoice payment status (MySQL)
ALTER TABLE `invoices` ADD COLUMN `paymentStatus` VARCHAR(20) NULL;

CREATE TABLE `payment_allocations` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `cashTransactionId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `allocatedAmount` DECIMAL(15, 2) NOT NULL,
    `allocatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`),
    INDEX `payment_allocations_companyId_invoiceId_idx`(`companyId`, `invoiceId`),
    INDEX `payment_allocations_cashTransactionId_idx`(`cashTransactionId`),
    CONSTRAINT `payment_allocations_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `payment_allocations_cashTransactionId_fkey` FOREIGN KEY (`cashTransactionId`) REFERENCES `cash_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `payment_allocations_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
