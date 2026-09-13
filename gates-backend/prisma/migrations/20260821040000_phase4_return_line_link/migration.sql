-- Phase 4 (H10): returns must be traceable to the original sold/purchased line
-- so over-return can be blocked server-side instead of relying on free-text
-- description references.
ALTER TABLE `invoice_lines` ADD COLUMN `originalInvoiceLineId` VARCHAR(191) NULL;
CREATE INDEX `invoice_lines_originalInvoiceLineId_idx` ON `invoice_lines`(`originalInvoiceLineId`);

ALTER TABLE `invoice_lines`
  ADD CONSTRAINT `invoice_lines_originalInvoiceLineId_fkey`
  FOREIGN KEY (`originalInvoiceLineId`) REFERENCES `invoice_lines`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
