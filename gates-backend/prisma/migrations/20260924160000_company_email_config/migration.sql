CREATE TABLE `company_email_configs` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `host` VARCHAR(255) NOT NULL,
  `port` INTEGER NOT NULL DEFAULT 587,
  `secure` BOOLEAN NOT NULL DEFAULT false,
  `username` VARCHAR(255) NULL,
  `passwordEncrypted` TEXT NULL,
  `fromEmail` VARCHAR(255) NOT NULL,
  `fromName` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `company_email_configs_companyId_key`(`companyId`),
  INDEX `company_email_configs_companyId_idx`(`companyId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `company_email_configs` ADD CONSTRAINT `company_email_configs_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
