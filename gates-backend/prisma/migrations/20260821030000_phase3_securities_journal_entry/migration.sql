-- Phase 3 (H11): securities receipts/payments must post real, reversible
-- journal entries instead of just flipping isPosted with zero GL effect.
ALTER TABLE `securities_receipts` ADD COLUMN `journalEntryId` VARCHAR(191) NULL;
ALTER TABLE `securities_payments` ADD COLUMN `journalEntryId` VARCHAR(191) NULL;
