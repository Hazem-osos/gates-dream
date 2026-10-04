CREATE TABLE `hr_lookups` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(40) NOT NULL,
  `code` VARCHAR(191) NULL,
  `arabicName` VARCHAR(191) NOT NULL,
  `englishName` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `hr_lookups_companyId_kind_idx`(`companyId`, `kind`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `hr_lookups` ADD CONSTRAINT `hr_lookups_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `hr_attendance_records` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(40) NOT NULL,
  `employeeId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NULL,
  `date` DATETIME(3) NULL,
  `fromTime` VARCHAR(191) NULL,
  `toTime` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `payload` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `hr_attendance_records_companyId_kind_idx`(`companyId`, `kind`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `hr_attendance_records` ADD CONSTRAINT `hr_attendance_records_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `wage_policies` ADD COLUMN `rules` JSON NULL;
ALTER TABLE `allowances` ADD COLUMN `defaultAmount` DECIMAL(15, 2) NULL;
ALTER TABLE `deductions` ADD COLUMN `defaultAmount` DECIMAL(15, 2) NULL;
