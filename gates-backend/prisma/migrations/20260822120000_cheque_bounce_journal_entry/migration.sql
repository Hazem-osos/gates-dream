-- Wave 2: the bounce JE id was never stored on the cheque, making a bounce
-- impossible to reverse. Mirrors the existing endorseJournalEntryId column.
ALTER TABLE `cheques` ADD COLUMN `bounceJournalEntryId` CHAR(36) NULL;

ALTER TABLE `cheques`
  ADD CONSTRAINT `cheques_bounceJournalEntryId_fkey`
    FOREIGN KEY (`bounceJournalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
