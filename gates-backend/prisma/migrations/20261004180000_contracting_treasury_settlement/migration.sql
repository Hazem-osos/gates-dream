-- P0-2: Contracting treasury settlement allocations (Enterprise ClientInvoice / SubcontractInvoice)

CREATE TABLE `contracting_certificate_allocations` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `cashTransactionId` VARCHAR(191) NOT NULL,
    `clientInvoiceId` VARCHAR(191) NULL,
    `subcontractInvoiceId` VARCHAR(191) NULL,
    `allocatedAmount` DECIMAL(18, 4) NOT NULL,
    `currencyCode` VARCHAR(10) NOT NULL DEFAULT 'EGP',
    `allocatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cca_co_client_inv_idx`(`companyId`, `clientInvoiceId`),
    INDEX `cca_co_sub_inv_idx`(`companyId`, `subcontractInvoiceId`),
    INDEX `cca_cash_tx_idx`(`cashTransactionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `contracting_certificate_allocations` ADD CONSTRAINT `cca_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `contracting_certificate_allocations` ADD CONSTRAINT `cca_cashTransactionId_fkey` FOREIGN KEY (`cashTransactionId`) REFERENCES `cash_transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `contracting_certificate_allocations` ADD CONSTRAINT `cca_clientInvoiceId_fkey` FOREIGN KEY (`clientInvoiceId`) REFERENCES `client_invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `contracting_certificate_allocations` ADD CONSTRAINT `cca_subcontractInvoiceId_fkey` FOREIGN KEY (`subcontractInvoiceId`) REFERENCES `subcontract_invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `client_invoices`
    ADD COLUMN `collectedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `remainingSettlementAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `settlementStatus` ENUM('UNPAID', 'PARTIALLY_SETTLED', 'SETTLED') NOT NULL DEFAULT 'UNPAID';

ALTER TABLE `subcontract_invoices`
    ADD COLUMN `paidSettlementAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `remainingSettlementAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `settlementStatus` ENUM('UNPAID', 'PARTIALLY_SETTLED', 'SETTLED') NOT NULL DEFAULT 'UNPAID';

-- Backfill remaining = net for posted certificates with no collections yet
UPDATE `client_invoices`
SET `remainingSettlementAmount` = `netPayableByClient`
WHERE `journalEntryId` IS NOT NULL;

UPDATE `subcontract_invoices`
SET `remainingSettlementAmount` = `netPayableAmount`
WHERE `journalEntryId` IS NOT NULL;
