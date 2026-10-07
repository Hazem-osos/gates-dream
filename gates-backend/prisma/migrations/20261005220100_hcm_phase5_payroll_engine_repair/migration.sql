-- Repair partial apply of phase 5 migration (short index names)

CREATE TABLE IF NOT EXISTS `hcm_compensation_component_assignments` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `employmentId` VARCHAR(191) NOT NULL,
  `payComponentId` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `currencyCode` VARCHAR(10) NOT NULL DEFAULT 'EGP',
  `effectiveFrom` DATE NOT NULL,
  `effectiveTo` DATE NULL,
  `sourceType` VARCHAR(32) NOT NULL DEFAULT 'EMPLOYEE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `hcm_comp_assign_co_emp_idx`(`companyId`, `employmentId`),
  INDEX `hcm_comp_assign_emp_from_idx`(`employmentId`, `effectiveFrom`),
  CONSTRAINT `hcm_comp_assign_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hcm_comp_assign_employmentId_fkey` FOREIGN KEY (`employmentId`) REFERENCES `hcm_employments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hcm_comp_assign_payComponentId_fkey` FOREIGN KEY (`payComponentId`) REFERENCES `hcm_pay_components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hcm_payroll_one_time_inputs` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `employmentId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `payComponentId` VARCHAR(191) NOT NULL,
  `periodYear` INTEGER NOT NULL,
  `periodMonth` INTEGER NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `reason` TEXT NULL,
  `source` VARCHAR(40) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `approvedById` VARCHAR(36) NULL,
  `approvedAt` DATETIME(3) NULL,
  `consumedRunId` VARCHAR(36) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `hcm_payroll_input_co_per_st_idx`(`companyId`, `periodYear`, `periodMonth`, `status`),
  INDEX `hcm_payroll_one_time_inputs_employmentId_idx`(`employmentId`),
  CONSTRAINT `hcm_payroll_one_time_inputs_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hcm_payroll_one_time_inputs_employmentId_fkey` FOREIGN KEY (`employmentId`) REFERENCES `hcm_employments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hcm_payroll_one_time_inputs_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `hcm_payroll_one_time_inputs_payComponentId_fkey` FOREIGN KEY (`payComponentId`) REFERENCES `hcm_pay_components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hcm_payroll_run_snapshots` (
  `id` VARCHAR(191) NOT NULL,
  `payrollRunId` VARCHAR(191) NOT NULL,
  `ruleSetFingerprint` VARCHAR(64) NOT NULL,
  `inputSnapshot` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hcm_payroll_run_snapshots_payrollRunId_key`(`payrollRunId`),
  CONSTRAINT `hcm_payroll_run_snapshots_payrollRunId_fkey` FOREIGN KEY (`payrollRunId`) REFERENCES `payroll_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hcm_payroll_item_components` (
  `id` VARCHAR(191) NOT NULL,
  `payrollRunItemId` VARCHAR(191) NOT NULL,
  `payComponentId` VARCHAR(191) NULL,
  `componentCode` VARCHAR(40) NOT NULL,
  `componentType` VARCHAR(32) NOT NULL,
  `phase` INTEGER NOT NULL DEFAULT 0,
  `amount` DECIMAL(15, 4) NOT NULL,
  `quantity` DECIMAL(15, 4) NULL,
  `baseAmount` DECIMAL(15, 4) NULL,
  `rate` DECIMAL(15, 6) NULL,
  `ruleCode` VARCHAR(60) NULL,
  `explanation` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `hcm_payroll_item_components_payrollRunItemId_idx`(`payrollRunItemId`),
  INDEX `hcm_payroll_item_components_componentCode_idx`(`componentCode`),
  CONSTRAINT `hcm_payroll_item_components_payrollRunItemId_fkey` FOREIGN KEY (`payrollRunItemId`) REFERENCES `payroll_run_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hcm_payroll_item_components_payComponentId_fkey` FOREIGN KEY (`payComponentId`) REFERENCES `hcm_pay_components`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hcm_payroll_localization_configs` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `countryCode` VARCHAR(4) NOT NULL,
  `effectiveFrom` DATE NOT NULL,
  `effectiveTo` DATE NULL,
  `configKey` VARCHAR(60) NOT NULL,
  `configJson` JSON NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hcm_pay_loc_co_ct_key_from_key`(`companyId`, `countryCode`, `configKey`, `effectiveFrom`),
  INDEX `hcm_payroll_localization_configs_companyId_countryCode_idx`(`companyId`, `countryCode`),
  CONSTRAINT `hcm_payroll_localization_configs_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
