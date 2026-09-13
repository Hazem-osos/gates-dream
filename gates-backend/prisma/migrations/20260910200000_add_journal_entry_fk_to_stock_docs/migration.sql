-- AlterTable
ALTER TABLE `opening_stocks` ADD COLUMN `journalEntryId` VARCHAR(191) NULL;
ALTER TABLE `stocktaking` ADD COLUMN `journalEntryId` VARCHAR(191) NULL;
ALTER TABLE `transfers` ADD COLUMN `journalEntryId` VARCHAR(191) NULL;
ALTER TABLE `receipts` ADD COLUMN `journalEntryId` VARCHAR(191) NULL;
ALTER TABLE `issues` ADD COLUMN `journalEntryId` VARCHAR(191) NULL;
ALTER TABLE `adjustments` ADD COLUMN `journalEntryId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `opening_stocks_journalEntryId_idx` ON `opening_stocks`(`journalEntryId`);
CREATE INDEX `stocktaking_journalEntryId_idx` ON `stocktaking`(`journalEntryId`);
CREATE INDEX `transfers_journalEntryId_idx` ON `transfers`(`journalEntryId`);
CREATE INDEX `receipts_journalEntryId_idx` ON `receipts`(`journalEntryId`);
CREATE INDEX `issues_journalEntryId_idx` ON `issues`(`journalEntryId`);
CREATE INDEX `adjustments_journalEntryId_idx` ON `adjustments`(`journalEntryId`);

-- AddForeignKey
ALTER TABLE `opening_stocks` ADD CONSTRAINT `opening_stocks_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `stocktaking` ADD CONSTRAINT `stocktaking_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `receipts` ADD CONSTRAINT `receipts_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `issues` ADD CONSTRAINT `issues_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `adjustments` ADD CONSTRAINT `adjustments_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
