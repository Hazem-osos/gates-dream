-- Phase 1 — C11: reversal is a contra entry, not a status flag.
-- `reversalOfJournalEntryId` links a dated contra entry back to the posted
-- entry it neutralizes. Unique because a JE can be reversed at most once —
-- reversing a reversal is a fresh re-post, not a second contra on the same row.

-- AlterTable
ALTER TABLE `journal_entries` ADD COLUMN `reversalOfJournalEntryId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `journal_entries_reversalOfJournalEntryId_key` ON `journal_entries`(`reversalOfJournalEntryId`);

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_reversalOfJournalEntryId_fkey` FOREIGN KEY (`reversalOfJournalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
