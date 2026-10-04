ALTER TABLE `e_invoice_documents`
  ADD COLUMN `submittedByUserId` CHAR(36) NULL,
  ADD COLUMN `submittedByName` VARCHAR(191) NULL;
