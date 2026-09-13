ALTER TABLE `invoices`
  ADD COLUMN `workflowStatus` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `workflowSubmittedAt` DATETIME(3) NULL,
  ADD COLUMN `workflowSubmittedBy` VARCHAR(191) NULL,
  ADD COLUMN `workflowApprovedAt` DATETIME(3) NULL,
  ADD COLUMN `workflowApprovedBy` VARCHAR(191) NULL,
  ADD COLUMN `workflowRejectedAt` DATETIME(3) NULL,
  ADD COLUMN `workflowRejectedBy` VARCHAR(191) NULL,
  ADD COLUMN `workflowRejectionReason` TEXT NULL,
  ADD COLUMN `createdBy` VARCHAR(191) NULL;

ALTER TABLE `journal_entries`
  ADD COLUMN `workflowStatus` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `workflowSubmittedAt` DATETIME(3) NULL,
  ADD COLUMN `workflowSubmittedBy` VARCHAR(191) NULL,
  ADD COLUMN `workflowApprovedAt` DATETIME(3) NULL,
  ADD COLUMN `workflowApprovedBy` VARCHAR(191) NULL,
  ADD COLUMN `workflowRejectedAt` DATETIME(3) NULL,
  ADD COLUMN `workflowRejectedBy` VARCHAR(191) NULL,
  ADD COLUMN `workflowRejectionReason` TEXT NULL;

UPDATE `invoices` SET `workflowStatus` = 'POSTED' WHERE `isPosted` = true;
UPDATE `journal_entries` SET `workflowStatus` = 'POSTED' WHERE `isPosted` = true;
