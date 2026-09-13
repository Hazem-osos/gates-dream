-- Wave 4 M17/M22: Fiscal year close metadata & retained earnings setting
ALTER TABLE `fiscal_years`
  ADD COLUMN `closedAt` DATETIME(3) NULL,
  ADD COLUMN `closedBy` VARCHAR(191) NULL,
  ADD COLUMN `closingJournalEntryId` VARCHAR(191) NULL;

ALTER TABLE `company_settings`
  ADD COLUMN `retainedEarningsAccountId` VARCHAR(191) NULL;
