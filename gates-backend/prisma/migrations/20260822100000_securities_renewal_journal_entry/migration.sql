-- Wave 2: securities renewals must post a real, reversible journal entry for
-- a non-zero renewal fee instead of just flipping isPosted with zero GL effect.
ALTER TABLE `securities_renewals` ADD COLUMN `journalEntryId` VARCHAR(191) NULL;
