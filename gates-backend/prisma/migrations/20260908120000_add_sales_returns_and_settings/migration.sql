-- Sales returns engine: SALES_RETURN settings + original-invoice linkage

ALTER TABLE `transaction_settings`
  MODIFY `documentType` ENUM(
    'SALES_INVOICE',
    'PURCHASE_INVOICE',
    'PAYMENT_VOUCHER',
    'RECEIPT_VOUCHER',
    'STOCK_ISSUE',
    'STOCK_RECEIPT',
    'SALES_RETURN'
  ) NOT NULL DEFAULT 'SALES_INVOICE';

ALTER TABLE `document_profiles`
  MODIFY `baseType` ENUM(
    'SALES_INVOICE',
    'PURCHASE_INVOICE',
    'PAYMENT_VOUCHER',
    'RECEIPT_VOUCHER',
    'STOCK_ISSUE',
    'STOCK_RECEIPT',
    'SALES_RETURN'
  ) NOT NULL;

ALTER TABLE `transaction_settings`
  ADD COLUMN `allowStandaloneReturns` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `enforceOriginalPrice` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `invoices`
  ADD COLUMN `originalInvoiceId` VARCHAR(191) NULL,
  ADD COLUMN `originalInvoiceNumber` VARCHAR(50) NULL;

CREATE INDEX `invoices_originalInvoiceId_idx` ON `invoices`(`originalInvoiceId`);

ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_originalInvoiceId_fkey`
    FOREIGN KEY (`originalInvoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
