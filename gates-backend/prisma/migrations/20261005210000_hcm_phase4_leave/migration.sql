-- HCM Phase 4 — Leave & Absence

ALTER TABLE `hcm_attendance_days`
  ADD COLUMN `paidLeaveMinutes` INT NOT NULL DEFAULT 0,
  ADD COLUMN `unpaidLeaveMinutes` INT NOT NULL DEFAULT 0,
  ADD COLUMN `sickLeaveMinutes` INT NOT NULL DEFAULT 0,
  ADD COLUMN `otherApprovedLeaveMinutes` INT NOT NULL DEFAULT 0;

CREATE TABLE `hcm_leave_types` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `arabicName` VARCHAR(120) NOT NULL,
  `englishName` VARCHAR(120) NULL,
  `paidClassification` VARCHAR(20) NOT NULL DEFAULT 'PAID',
  `requiresBalance` BOOLEAN NOT NULL DEFAULT true,
  `requiresAttachment` BOOLEAN NOT NULL DEFAULT false,
  `attendanceClassification` VARCHAR(30) NOT NULL DEFAULT 'PAID_LEAVE',
  `payrollClassification` VARCHAR(40) NULL,
  `displayOrder` INT NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hcm_leave_types_companyId_code_key`(`companyId`, `code`),
  INDEX `hcm_leave_types_companyId_isActive_idx`(`companyId`, `isActive`),
  CONSTRAINT `hcm_leave_types_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hcm_leave_policies` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `arabicName` VARCHAR(120) NOT NULL,
  `effectiveFrom` DATE NOT NULL,
  `effectiveTo` DATE NULL,
  `rules` JSON NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hcm_leave_policies_companyId_code_effectiveFrom_key`(`companyId`, `code`, `effectiveFrom`),
  INDEX `hcm_leave_policies_companyId_effectiveFrom_idx`(`companyId`, `effectiveFrom`),
  CONSTRAINT `hcm_leave_policies_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hcm_leave_policy_rules` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `policyId` VARCHAR(191) NOT NULL,
  `leaveTypeId` VARCHAR(191) NOT NULL,
  `rules` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hcm_leave_policy_rules_policyId_leaveTypeId_key`(`policyId`, `leaveTypeId`),
  INDEX `hcm_leave_policy_rules_companyId_idx`(`companyId`),
  CONSTRAINT `hcm_leave_policy_rules_policyId_fkey` FOREIGN KEY (`policyId`) REFERENCES `hcm_leave_policies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hcm_leave_policy_rules_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `hcm_leave_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hcm_leave_enrollments` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `employmentId` VARCHAR(191) NOT NULL,
  `policyId` VARCHAR(191) NOT NULL,
  `effectiveFrom` DATE NOT NULL,
  `effectiveTo` DATE NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `hcm_leave_enrollments_companyId_employmentId_effectiveFrom_idx`(`companyId`, `employmentId`, `effectiveFrom`),
  CONSTRAINT `hcm_leave_enrollments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hcm_leave_enrollments_employmentId_fkey` FOREIGN KEY (`employmentId`) REFERENCES `hcm_employments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hcm_leave_enrollments_policyId_fkey` FOREIGN KEY (`policyId`) REFERENCES `hcm_leave_policies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hcm_leave_requests` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `employmentId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `leaveTypeId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `startDate` DATE NOT NULL,
  `endDate` DATE NOT NULL,
  `unit` VARCHAR(10) NOT NULL DEFAULT 'DAYS',
  `requestedQuantity` DECIMAL(12, 4) NOT NULL,
  `calculatedQuantity` DECIMAL(12, 4) NULL,
  `reason` TEXT NULL,
  `attachmentRef` VARCHAR(191) NULL,
  `calculationDetail` JSON NULL,
  `submittedAt` DATETIME(3) NULL,
  `submittedBy` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectedBy` VARCHAR(191) NULL,
  `rejectionReason` TEXT NULL,
  `cancelledAt` DATETIME(3) NULL,
  `cancelledBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `hcm_leave_requests_companyId_status_startDate_idx`(`companyId`, `status`, `startDate`),
  INDEX `hcm_leave_requests_companyId_employmentId_status_idx`(`companyId`, `employmentId`, `status`),
  CONSTRAINT `hcm_leave_requests_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hcm_leave_requests_employmentId_fkey` FOREIGN KEY (`employmentId`) REFERENCES `hcm_employments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hcm_leave_requests_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hcm_leave_requests_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `hcm_leave_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hcm_leave_ledger_entries` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `employmentId` VARCHAR(191) NOT NULL,
  `leaveTypeId` VARCHAR(191) NOT NULL,
  `effectiveDate` DATE NOT NULL,
  `quantity` DECIMAL(12, 4) NOT NULL,
  `unit` VARCHAR(10) NOT NULL DEFAULT 'DAYS',
  `transactionType` VARCHAR(30) NOT NULL,
  `sourceKey` VARCHAR(191) NOT NULL,
  `requestId` VARCHAR(191) NULL,
  `reason` TEXT NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hcm_leave_ledger_entries_companyId_sourceKey_key`(`companyId`, `sourceKey`),
  INDEX `hcm_leave_ledger_entries_co_emp_type_date_idx`(`companyId`, `employmentId`, `leaveTypeId`, `effectiveDate`),
  INDEX `hcm_leave_ledger_entries_co_emp_tx_idx`(`companyId`, `employmentId`, `transactionType`),
  CONSTRAINT `hcm_leave_ledger_entries_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hcm_leave_ledger_entries_employmentId_fkey` FOREIGN KEY (`employmentId`) REFERENCES `hcm_employments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hcm_leave_ledger_entries_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `hcm_leave_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hcm_leave_ledger_entries_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `hcm_leave_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hcm_leave_request_days` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `requestId` VARCHAR(191) NOT NULL,
  `workDate` DATE NOT NULL,
  `segmentType` VARCHAR(20) NOT NULL DEFAULT 'FULL',
  `startAt` DATETIME(3) NULL,
  `endAt` DATETIME(3) NULL,
  `chargeableDays` DECIMAL(12, 4) NOT NULL DEFAULT 0,
  `chargeableMinutes` INT NOT NULL DEFAULT 0,
  `calendarDetail` JSON NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hcm_leave_request_days_requestId_workDate_segmentType_key`(`requestId`, `workDate`, `segmentType`),
  INDEX `hcm_leave_request_days_companyId_workDate_idx`(`companyId`, `workDate`),
  CONSTRAINT `hcm_leave_request_days_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hcm_leave_request_days_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `hcm_leave_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hcm_leave_accrual_runs` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `periodKey` VARCHAR(40) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  `processed` INT NOT NULL DEFAULT 0,
  `credited` INT NOT NULL DEFAULT 0,
  `skipped` INT NOT NULL DEFAULT 0,
  `failed` INT NOT NULL DEFAULT 0,
  `details` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hcm_leave_accrual_runs_companyId_periodKey_key`(`companyId`, `periodKey`),
  CONSTRAINT `hcm_leave_accrual_runs_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
