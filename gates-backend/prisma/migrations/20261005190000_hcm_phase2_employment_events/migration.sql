CREATE TABLE `hcm_employment_events` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `employmentId` VARCHAR(191) NOT NULL,
  `eventType` VARCHAR(40) NOT NULL,
  `effectiveDate` DATE NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `reason` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `payload` JSON NULL,
  `beforeSnapshot` JSON NULL,
  `afterSnapshot` JSON NULL,
  `requestedBy` VARCHAR(191) NULL,
  `requestedAt` DATETIME(3) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `rejectedBy` VARCHAR(191) NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectionReason` TEXT NULL,
  `appliedAt` DATETIME(3) NULL,
  `sourceProcedureId` VARCHAR(191) NULL,
  `assignmentId` VARCHAR(191) NULL,
  `compensationId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `hcm_employment_events_companyId_employmentId_idx`(`companyId`, `employmentId`),
  INDEX `hcm_employment_events_companyId_status_idx`(`companyId`, `status`),
  INDEX `hcm_employment_events_employmentId_effectiveDate_idx`(`employmentId`, `effectiveDate`),
  INDEX `hcm_employment_events_eventType_idx`(`eventType`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `hcm_employment_events` ADD CONSTRAINT `hcm_employment_events_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `hcm_employment_events` ADD CONSTRAINT `hcm_employment_events_employmentId_fkey` FOREIGN KEY (`employmentId`) REFERENCES `hcm_employments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
