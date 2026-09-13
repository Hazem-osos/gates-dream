ALTER TABLE `cash_transaction_lines`
  ADD COLUMN `entrySide` VARCHAR(10) NOT NULL DEFAULT 'DEBIT',
  ADD COLUMN `isTiedToInvoice` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `invoiceId` VARCHAR(191) NULL;

CREATE INDEX `cash_transaction_lines_invoiceId_idx` ON `cash_transaction_lines`(`invoiceId`);

ALTER TABLE `cash_transaction_lines`
  ADD CONSTRAINT `cash_transaction_lines_invoiceId_fkey`
  FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
