-- Wave 1 M5: Invoice posting linkage (GL, branch, fiscal year)

ALTER TABLE `invoices` ADD COLUMN `branchId` VARCHAR(191) NULL,
    ADD COLUMN `costJournalEntryId` VARCHAR(191) NULL,
    ADD COLUMN `exchangeRate` DECIMAL(18, 6) NOT NULL DEFAULT 1,
    ADD COLUMN `fiscalYearId` VARCHAR(191) NULL,
    ADD COLUMN `invoiceKind` VARCHAR(30) NULL,
    ADD COLUMN `journalEntryId` VARCHAR(191) NULL,
    ADD COLUMN `postedAt` DATETIME(3) NULL,
    ADD COLUMN `postedBy` VARCHAR(191) NULL,
    ADD COLUMN `sourceYearId` VARCHAR(20) NULL,
    ADD COLUMN `withholdingTaxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0;

ALTER TABLE `invoices` ADD CONSTRAINT `invoices_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `invoices` ADD CONSTRAINT `invoices_fiscalYearId_fkey` FOREIGN KEY (`fiscalYearId`) REFERENCES `fiscal_years`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `invoices` ADD CONSTRAINT `invoices_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `invoices` ADD CONSTRAINT `invoices_costJournalEntryId_fkey` FOREIGN KEY (`costJournalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
