-- P2-2 profitability snapshots and manual forecast overrides

CREATE TABLE `project_cost_forecast_snapshots` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `snapshotDate` DATETIME(3) NOT NULL,
  `label` VARCHAR(255) NULL,
  `revisedContractValue` DECIMAL(18, 4) NOT NULL,
  `actualCost` DECIMAL(18, 4) NOT NULL,
  `remainingCommitment` DECIMAL(18, 4) NOT NULL,
  `uncommittedCostToComplete` DECIMAL(18, 4) NOT NULL,
  `estimateAtCompletion` DECIMAL(18, 4) NOT NULL,
  `forecastProfit` DECIMAL(18, 4) NOT NULL,
  `forecastMarginPercent` DECIMAL(18, 6) NOT NULL,
  `progressPercent` DECIMAL(18, 6) NOT NULL,
  `payload` JSON NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `pcfs_company_project_idx` (`companyId`, `projectId`),
  INDEX `pcfs_snapshot_date_idx` (`snapshotDate`),
  CONSTRAINT `pcfs_company_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pcfs_project_fk` FOREIGN KEY (`projectId`) REFERENCES `contracting_projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `project_boq_forecast_overrides` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `projectBOQItemId` VARCHAR(191) NULL,
  `forecastRemainingCost` DECIMAL(18, 4) NOT NULL,
  `forecastMethod` ENUM('MANUAL_FORECAST') NOT NULL DEFAULT 'MANUAL_FORECAST',
  `reason` TEXT NOT NULL,
  `effectiveFrom` DATETIME(3) NOT NULL,
  `createdBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `pbfo_company_project_idx` (`companyId`, `projectId`),
  INDEX `pbfo_boq_idx` (`projectBOQItemId`),
  CONSTRAINT `pbfo_company_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pbfo_project_fk` FOREIGN KEY (`projectId`) REFERENCES `contracting_projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `pbfo_boq_fk` FOREIGN KEY (`projectBOQItemId`) REFERENCES `project_owner_boq_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
