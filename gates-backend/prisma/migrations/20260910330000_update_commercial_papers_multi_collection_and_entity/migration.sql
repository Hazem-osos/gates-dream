ALTER TABLE `securities_receipts`
  ADD COLUMN `entityName` VARCHAR(191) NULL,
  ADD COLUMN `destinationAccountId` VARCHAR(191) NULL,
  ADD COLUMN `commissionAmount` DECIMAL(15, 2) NULL,
  ADD COLUMN `commissionAccountId` VARCHAR(191) NULL;

ALTER TABLE `securities_payments`
  ADD COLUMN `entityName` VARCHAR(191) NULL,
  ADD COLUMN `destinationAccountId` VARCHAR(191) NULL,
  ADD COLUMN `commissionAmount` DECIMAL(15, 2) NULL,
  ADD COLUMN `commissionAccountId` VARCHAR(191) NULL;

CREATE TABLE `multi_collection_lines` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `paperKind` VARCHAR(20) NOT NULL,
  `paperId` VARCHAR(191) NOT NULL,
  `accountId` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `description` VARCHAR(191) NULL,
  `collectionDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `hijriDate` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `multi_collection_lines_companyId_paperKind_paperId_idx`
  ON `multi_collection_lines`(`companyId`, `paperKind`, `paperId`);

CREATE INDEX `multi_collection_lines_accountId_idx`
  ON `multi_collection_lines`(`accountId`);

ALTER TABLE `multi_collection_lines`
  ADD CONSTRAINT `multi_collection_lines_accountId_fkey`
    FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
