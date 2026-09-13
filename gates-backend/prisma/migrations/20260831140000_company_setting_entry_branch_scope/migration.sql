-- DropIndex
DROP INDEX `company_setting_entries_companyId_name_key` ON `company_setting_entries`;

-- AlterTable
ALTER TABLE `company_setting_entries` ADD COLUMN `branchId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `company_setting_entries_companyId_branchId_name_key` ON `company_setting_entries`(`companyId`, `branchId`, `name`);

-- AddForeignKey
ALTER TABLE `company_setting_entries` ADD CONSTRAINT `company_setting_entries_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

