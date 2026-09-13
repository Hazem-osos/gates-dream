-- L2 fix (Item 41): support endorsing (تظهير) an inward cheque to a
-- supplier instead of depositing it, and allow bouncing an endorsed cheque
-- (previously only SENT_TO_BANK cheques could bounce).
ALTER TABLE `cheques`
  ADD COLUMN `endorsedSupplierId` CHAR(36) NULL,
  ADD COLUMN `endorseJournalEntryId` CHAR(36) NULL;

ALTER TABLE `cheques`
  ADD CONSTRAINT `cheques_endorsedSupplierId_fkey`
    FOREIGN KEY (`endorsedSupplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `cheques_endorseJournalEntryId_fkey`
    FOREIGN KEY (`endorseJournalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `cheques_endorsedSupplierId_idx` ON `cheques`(`endorsedSupplierId`);
