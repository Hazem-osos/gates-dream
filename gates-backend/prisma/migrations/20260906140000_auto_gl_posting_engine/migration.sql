-- Auto-GL posting engine: company toggle + document sourceId on journal entries.

ALTER TABLE `company_settings`
  ADD COLUMN `autoPostGl` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `journal_entries`
  ADD COLUMN `sourceId` VARCHAR(80) NULL;

CREATE INDEX `journal_entries_companyId_sourceType_sourceId_idx`
  ON `journal_entries`(`companyId`, `sourceType`, `sourceId`);
