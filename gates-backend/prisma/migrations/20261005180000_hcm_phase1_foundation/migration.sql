-- HCM Phase 1: Position, Employment, effective-dated assignments, Department evolution

ALTER TABLE `departments`
  ADD COLUMN `unitType` VARCHAR(20) NOT NULL DEFAULT 'DEPARTMENT',
  ADD COLUMN `branchId` VARCHAR(191) NULL,
  ADD COLUMN `managerPositionId` VARCHAR(191) NULL;

CREATE INDEX `departments_companyId_unitType_idx` ON `departments`(`companyId`, `unitType`);
CREATE INDEX `departments_branchId_idx` ON `departments`(`branchId`);

ALTER TABLE `employee_contracts`
  ADD COLUMN `employmentId` VARCHAR(191) NULL;

CREATE INDEX `employee_contracts_employmentId_idx` ON `employee_contracts`(`employmentId`);
CREATE INDEX `employee_contracts_sectionId_idx` ON `employee_contracts`(`sectionId`);

CREATE TABLE `hcm_positions` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `arabicName` VARCHAR(191) NOT NULL,
  `englishName` VARCHAR(191) NULL,
  `jobTitleId` VARCHAR(191) NULL,
  `departmentId` VARCHAR(191) NULL,
  `branchId` VARCHAR(191) NULL,
  `jobCadreId` VARCHAR(191) NULL,
  `costCenterId` VARCHAR(191) NULL,
  `reportsToPositionId` VARCHAR(191) NULL,
  `headcountLimit` INTEGER NULL,
  `effectiveFrom` DATE NOT NULL,
  `effectiveTo` DATE NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hcm_positions_companyId_code_key`(`companyId`, `code`),
  INDEX `hcm_positions_companyId_isActive_idx`(`companyId`, `isActive`),
  INDEX `hcm_positions_departmentId_idx`(`departmentId`),
  INDEX `hcm_positions_reportsToPositionId_idx`(`reportsToPositionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hcm_employments` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `employmentNumber` VARCHAR(191) NULL,
  `hireDate` DATE NOT NULL,
  `originalHireDate` DATE NULL,
  `employmentType` VARCHAR(40) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `probationStart` DATE NULL,
  `probationEnd` DATE NULL,
  `terminationDate` DATE NULL,
  `terminationReason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hcm_employments_companyId_employeeId_key`(`companyId`, `employeeId`),
  INDEX `hcm_employments_companyId_status_idx`(`companyId`, `status`),
  INDEX `hcm_employments_employeeId_idx`(`employeeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hcm_employment_assignments` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `employmentId` VARCHAR(191) NOT NULL,
  `positionId` VARCHAR(191) NULL,
  `branchId` VARCHAR(191) NULL,
  `departmentId` VARCHAR(191) NULL,
  `jobTitleId` VARCHAR(191) NULL,
  `jobCadreId` VARCHAR(191) NULL,
  `managerPositionId` VARCHAR(191) NULL,
  `effectiveFrom` DATE NOT NULL,
  `effectiveTo` DATE NULL,
  `changeReason` VARCHAR(80) NULL,
  `sourceProcedureId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `hcm_employment_assignments_companyId_employmentId_idx`(`companyId`, `employmentId`),
  INDEX `hcm_employment_assignments_employmentId_effectiveFrom_idx`(`employmentId`, `effectiveFrom`),
  INDEX `hcm_employment_assignments_employmentId_effectiveTo_idx`(`employmentId`, `effectiveTo`),
  INDEX `hcm_employment_assignments_positionId_idx`(`positionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hcm_compensation_assignments` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `employmentId` VARCHAR(191) NOT NULL,
  `effectiveFrom` DATE NOT NULL,
  `effectiveTo` DATE NULL,
  `basicSalary` DECIMAL(15, 2) NOT NULL,
  `fixedAllowances` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `currencyCode` VARCHAR(10) NOT NULL DEFAULT 'EGP',
  `changeReason` VARCHAR(80) NULL,
  `sourceProcedureId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `hcm_compensation_assignments_companyId_employmentId_idx`(`companyId`, `employmentId`),
  INDEX `hcm_compensation_assignments_employmentId_effectiveFrom_idx`(`employmentId`, `effectiveFrom`),
  INDEX `hcm_compensation_assignments_employmentId_effectiveTo_idx`(`employmentId`, `effectiveTo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `departments` ADD CONSTRAINT `departments_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `departments` ADD CONSTRAINT `departments_managerPositionId_fkey` FOREIGN KEY (`managerPositionId`) REFERENCES `hcm_positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `employee_contracts` ADD CONSTRAINT `employee_contracts_employmentId_fkey` FOREIGN KEY (`employmentId`) REFERENCES `hcm_employments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `employee_contracts` ADD CONSTRAINT `employee_contracts_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `hcm_positions` ADD CONSTRAINT `hcm_positions_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `hcm_positions` ADD CONSTRAINT `hcm_positions_jobTitleId_fkey` FOREIGN KEY (`jobTitleId`) REFERENCES `job_titles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `hcm_positions` ADD CONSTRAINT `hcm_positions_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `hcm_positions` ADD CONSTRAINT `hcm_positions_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `hcm_positions` ADD CONSTRAINT `hcm_positions_jobCadreId_fkey` FOREIGN KEY (`jobCadreId`) REFERENCES `job_cadres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `hcm_positions` ADD CONSTRAINT `hcm_positions_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `hcm_positions` ADD CONSTRAINT `hcm_positions_reportsToPositionId_fkey` FOREIGN KEY (`reportsToPositionId`) REFERENCES `hcm_positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `hcm_employments` ADD CONSTRAINT `hcm_employments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `hcm_employments` ADD CONSTRAINT `hcm_employments_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `hcm_employment_assignments` ADD CONSTRAINT `hcm_employment_assignments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `hcm_employment_assignments` ADD CONSTRAINT `hcm_employment_assignments_employmentId_fkey` FOREIGN KEY (`employmentId`) REFERENCES `hcm_employments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `hcm_employment_assignments` ADD CONSTRAINT `hcm_employment_assignments_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `hcm_positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `hcm_employment_assignments` ADD CONSTRAINT `hcm_employment_assignments_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `hcm_employment_assignments` ADD CONSTRAINT `hcm_employment_assignments_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `hcm_employment_assignments` ADD CONSTRAINT `hcm_employment_assignments_jobTitleId_fkey` FOREIGN KEY (`jobTitleId`) REFERENCES `job_titles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `hcm_employment_assignments` ADD CONSTRAINT `hcm_employment_assignments_jobCadreId_fkey` FOREIGN KEY (`jobCadreId`) REFERENCES `job_cadres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `hcm_employment_assignments` ADD CONSTRAINT `hcm_employment_assignments_managerPositionId_fkey` FOREIGN KEY (`managerPositionId`) REFERENCES `hcm_positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `hcm_employment_assignments` ADD CONSTRAINT `hcm_employment_assignments_sourceProcedureId_fkey` FOREIGN KEY (`sourceProcedureId`) REFERENCES `employee_procedures`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `hcm_compensation_assignments` ADD CONSTRAINT `hcm_compensation_assignments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `hcm_compensation_assignments` ADD CONSTRAINT `hcm_compensation_assignments_employmentId_fkey` FOREIGN KEY (`employmentId`) REFERENCES `hcm_employments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `hcm_compensation_assignments` ADD CONSTRAINT `hcm_compensation_assignments_sourceProcedureId_fkey` FOREIGN KEY (`sourceProcedureId`) REFERENCES `employee_procedures`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
