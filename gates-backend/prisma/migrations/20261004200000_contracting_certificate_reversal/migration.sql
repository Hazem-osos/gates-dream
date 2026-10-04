-- P0-4: financial reversal metadata on canonical certificates + reversal idempotency ops.

ALTER TABLE `client_invoices`
  ADD COLUMN `reversalJournalEntryId` VARCHAR(191) NULL,
  ADD COLUMN `reversedAt` DATETIME(3) NULL,
  ADD COLUMN `reversedBy` VARCHAR(191) NULL,
  ADD COLUMN `reversalReason` TEXT NULL;

ALTER TABLE `subcontract_invoices`
  ADD COLUMN `reversalJournalEntryId` VARCHAR(191) NULL,
  ADD COLUMN `reversedAt` DATETIME(3) NULL,
  ADD COLUMN `reversedBy` VARCHAR(191) NULL,
  ADD COLUMN `reversalReason` TEXT NULL;

CREATE UNIQUE INDEX `client_inv_reversal_je_uniq` ON `client_invoices`(`reversalJournalEntryId`);
CREATE UNIQUE INDEX `sub_inv_reversal_je_uniq` ON `subcontract_invoices`(`reversalJournalEntryId`);

ALTER TABLE `client_invoices`
  ADD CONSTRAINT `client_invoices_reversalJournalEntryId_fkey`
  FOREIGN KEY (`reversalJournalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `subcontract_invoices`
  ADD CONSTRAINT `subcontract_invoices_reversalJournalEntryId_fkey`
  FOREIGN KEY (`reversalJournalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `contracting_settlement_idempotencies`
  MODIFY `operation` ENUM(
    'CLIENT_INVOICE_COLLECT',
    'SUBCONTRACT_INVOICE_PAY',
    'CLIENT_INVOICE_ALLOCATE',
    'SUBCONTRACT_INVOICE_ALLOCATE',
    'CLIENT_INVOICE_REVERSE',
    'SUBCONTRACT_INVOICE_REVERSE'
  ) NOT NULL;
