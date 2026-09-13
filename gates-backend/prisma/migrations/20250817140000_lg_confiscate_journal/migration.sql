-- LG confiscation posting journal link + trade settings account code
ALTER TABLE `guarantee_letters`
  ADD COLUMN `confiscateJournalEntryId` VARCHAR(191) NULL;

ALTER TABLE `trade_settings`
  ADD COLUMN `lgConfiscationLossAccountCode` VARCHAR(20) NULL;
