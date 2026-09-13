-- M5 invoice settlement: attribute a treasury cash transaction to the invoice it pays,
-- so paidAmount / remainingAmount can be recomputed from the ledger instead of guessed.
ALTER TABLE `cash_transactions` ADD COLUMN `invoiceId` VARCHAR(191) NULL;

CREATE INDEX `cash_transactions_invoiceId_idx` ON `cash_transactions`(`invoiceId`);

ALTER TABLE `cash_transactions`
  ADD CONSTRAINT `cash_transactions_invoiceId_fkey`
  FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
