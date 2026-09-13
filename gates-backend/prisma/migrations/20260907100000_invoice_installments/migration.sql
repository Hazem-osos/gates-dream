-- Invoice installment schedule + optional receipt link on cash transactions.

CREATE TABLE `invoice_installments` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `installmentNumber` INTEGER NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `hijriDueDate` VARCHAR(191) NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `paidAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `isPaid` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE') NOT NULL DEFAULT 'PENDING',
    `paymentDate` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoice_installments_invoiceId_installmentNumber_key`(`invoiceId`, `installmentNumber`),
    INDEX `invoice_installments_invoiceId_status_idx`(`invoiceId`, `status`),
    INDEX `invoice_installments_dueDate_idx`(`dueDate`),
    INDEX `invoice_installments_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `invoice_installments`
  ADD CONSTRAINT `invoice_installments_invoiceId_fkey`
  FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `cash_transactions` ADD COLUMN `invoiceInstallmentId` VARCHAR(191) NULL;
CREATE INDEX `cash_transactions_invoiceInstallmentId_idx` ON `cash_transactions`(`invoiceInstallmentId`);
ALTER TABLE `cash_transactions`
  ADD CONSTRAINT `cash_transactions_invoiceInstallmentId_fkey`
  FOREIGN KEY (`invoiceInstallmentId`) REFERENCES `invoice_installments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
