-- Wave 3 M12: Real estate projects, units, contracts & installments
-- MySQL 8

CREATE TABLE `real_estate_settings` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `realEstateArAccountCode` VARCHAR(20) NULL,
  `unearnedRealEstateRevenueAccountCode` VARCHAR(20) NULL,
  `realEstateRevenueAccountCode` VARCHAR(20) NULL,
  `maintenanceDepositsAccountCode` VARCHAR(20) NULL,
  `penaltyRevenueAccountCode` VARCHAR(20) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `real_estate_settings_companyId_key` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `real_estate_projects` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `projectCode` VARCHAR(191) NOT NULL,
  `projectName` VARCHAR(191) NOT NULL,
  `costCenterId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `real_estate_projects_companyId_projectCode_key` (`companyId`, `projectCode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `real_estate_buildings` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `buildingCode` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `totalFloors` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `real_estate_buildings_projectId_buildingCode_key` (`projectId`, `buildingCode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `real_estate_units` (
  `id` VARCHAR(191) NOT NULL,
  `buildingId` VARCHAR(191) NOT NULL,
  `unitCode` VARCHAR(191) NOT NULL,
  `unitType` VARCHAR(20) NOT NULL DEFAULT 'RESIDENTIAL',
  `floor` INTEGER NOT NULL DEFAULT 0,
  `grossArea` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `netArea` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `meterPrice` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalPrice` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `maintenanceDeposit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `real_estate_units_buildingId_unitCode_key` (`buildingId`, `unitCode`),
  INDEX `real_estate_units_buildingId_status_idx` (`buildingId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `unit_contracts` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `unitId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `contractNumber` VARCHAR(191) NOT NULL,
  `contractDate` DATETIME(3) NOT NULL,
  `deliveryDate` DATETIME(3) NULL,
  `totalContractAmount` DECIMAL(15, 2) NOT NULL,
  `downPayment` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `maintenanceAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `discountAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `financingInterest` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `outstandingArBalance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `unearnedRevenueBalance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `contractJournalEntryId` VARCHAR(191) NULL,
  `handoverJournalEntryId` VARCHAR(191) NULL,
  `postedAt` DATETIME(3) NULL,
  `handoverAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `unit_contracts_companyId_contractNumber_key` (`companyId`, `contractNumber`),
  INDEX `unit_contracts_unitId_idx` (`unitId`),
  INDEX `unit_contracts_customerId_idx` (`customerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `unit_installments` (
  `id` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `installmentNumber` INTEGER NOT NULL,
  `dueDate` DATETIME(3) NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `interestPortion` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `chequeId` VARCHAR(191) NULL,
  `paymentTransactionId` VARCHAR(191) NULL,
  `paidAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `unit_installments_contractId_installmentNumber_key` (`contractId`, `installmentNumber`),
  INDEX `unit_installments_contractId_status_idx` (`contractId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `real_estate_settings` ADD CONSTRAINT `real_estate_settings_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `real_estate_projects` ADD CONSTRAINT `real_estate_projects_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `real_estate_projects` ADD CONSTRAINT `real_estate_projects_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `real_estate_buildings` ADD CONSTRAINT `real_estate_buildings_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `real_estate_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `real_estate_units` ADD CONSTRAINT `real_estate_units_buildingId_fkey` FOREIGN KEY (`buildingId`) REFERENCES `real_estate_buildings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `unit_contracts` ADD CONSTRAINT `unit_contracts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `unit_contracts` ADD CONSTRAINT `unit_contracts_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `real_estate_units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `unit_contracts` ADD CONSTRAINT `unit_contracts_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `unit_installments` ADD CONSTRAINT `unit_installments_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `unit_contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `unit_installments` ADD CONSTRAINT `unit_installments_chequeId_fkey` FOREIGN KEY (`chequeId`) REFERENCES `cheques`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `unit_installments` ADD CONSTRAINT `unit_installments_paymentTransactionId_fkey` FOREIGN KEY (`paymentTransactionId`) REFERENCES `cash_transactions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
