-- Persist the NewModule suffix on invoices so numbering, settings and
-- posting resolve SI02 / PI02 / … instead of a hardcoded *01 map.
ALTER TABLE `invoices` ADD COLUMN `moduleCode` VARCHAR(4) NULL;
ALTER TABLE `invoices` ADD COLUMN `newModuleId` VARCHAR(191) NULL;

CREATE INDEX `invoices_companyId_moduleCode_idx` ON `invoices`(`companyId`, `moduleCode`);
CREATE INDEX `invoices_newModuleId_idx` ON `invoices`(`newModuleId`);

ALTER TABLE `invoices` ADD CONSTRAINT `invoices_newModuleId_fkey` FOREIGN KEY (`newModuleId`) REFERENCES `new_modules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
