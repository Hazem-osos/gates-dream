ALTER TABLE `journal_entry_lines`
  ADD COLUMN `isTiedToInvoice` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `invoiceId` VARCHAR(191) NULL,
  ADD COLUMN `invoiceNumber` VARCHAR(50) NULL;

CREATE INDEX `journal_entry_lines_invoiceId_idx` ON `journal_entry_lines`(`invoiceId`);

ALTER TABLE `journal_entry_lines`
  ADD CONSTRAINT `journal_entry_lines_invoiceId_fkey`
    FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
