-- Checkout ergonomics: split payments, internal notes, cheque ↔ invoice link

ALTER TABLE `invoices`
  ADD COLUMN `paymentSplits` JSON NULL,
  ADD COLUMN `internalNotes` JSON NULL;

ALTER TABLE `cheques`
  ADD COLUMN `invoiceId` CHAR(36) NULL,
  ADD INDEX `cheques_invoiceId_idx` (`invoiceId`);

ALTER TABLE `contract_extracts`
  ADD COLUMN `internalNotes` JSON NULL;
