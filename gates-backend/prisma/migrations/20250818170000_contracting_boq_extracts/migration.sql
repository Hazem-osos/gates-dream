-- Contracting BOQ & unified contract extracts (مستخلصات + جدول بنود المقايسة)

ALTER TABLE `contracting_projects`
  ADD COLUMN `advancePaymentAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER `contractValue`;

ALTER TABLE `contracting_settings`
  ADD COLUMN `inputVatAccountCode` VARCHAR(20) NULL AFTER `defaultWhtRate`,
  ADD COLUMN `penaltiesExpenseAccountCode` VARCHAR(20) NULL AFTER `inputVatAccountCode`;

CREATE TABLE `project_boq_items` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `itemNumber` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `unit` VARCHAR(20) NULL,
    `contractQuantity` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `unitPrice` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `totalPrice` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `lineOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `project_boq_items_projectId_itemNumber_key`(`projectId`, `itemNumber`),
    INDEX `project_boq_items_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `contract_extracts` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `projectSubcontractId` VARCHAR(191) NULL,
    `extractNumber` VARCHAR(191) NOT NULL,
    `extractType` VARCHAR(20) NOT NULL,
    `partyId` VARCHAR(191) NOT NULL,
    `extractDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `periodStart` DATETIME(3) NULL,
    `periodEnd` DATETIME(3) NULL,
    `totalExecutedAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `previousExecutedAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `currentExecutedAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `advancePaymentDeduction` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `retentionDeduction` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `whtDeduction` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `otherDeductions` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `penalties` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `netBeforeVat` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `vatAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `netPayableAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    `journalEntryId` VARCHAR(191) NULL,
    `postedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contract_extracts_companyId_extractNumber_key`(`companyId`, `extractNumber`),
    INDEX `contract_extracts_projectId_extractType_idx`(`projectId`, `extractType`),
    INDEX `contract_extracts_partyId_idx`(`partyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `contract_extract_lines` (
    `id` VARCHAR(191) NOT NULL,
    `extractId` VARCHAR(191) NOT NULL,
    `boqItemId` VARCHAR(191) NOT NULL,
    `previousQuantity` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `currentQuantity` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `cumulativeQuantity` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `unitPrice` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `lineOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `contract_extract_lines_extractId_idx`(`extractId`),
    INDEX `contract_extract_lines_boqItemId_idx`(`boqItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `project_boq_items` ADD CONSTRAINT `project_boq_items_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `contracting_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `contract_extracts` ADD CONSTRAINT `contract_extracts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `contract_extracts` ADD CONSTRAINT `contract_extracts_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `contracting_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `contract_extracts` ADD CONSTRAINT `contract_extracts_projectSubcontractId_fkey` FOREIGN KEY (`projectSubcontractId`) REFERENCES `project_subcontracts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `contract_extract_lines` ADD CONSTRAINT `contract_extract_lines_extractId_fkey` FOREIGN KEY (`extractId`) REFERENCES `contract_extracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `contract_extract_lines` ADD CONSTRAINT `contract_extract_lines_boqItemId_fkey` FOREIGN KEY (`boqItemId`) REFERENCES `project_boq_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
