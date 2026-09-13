-- Wave 3 M9: HR payroll engine
-- MySQL 8

ALTER TABLE `employees`
  ADD COLUMN `fixedAllowances` DECIMAL(15, 2) NULL DEFAULT 0,
  ADD COLUMN `socialInsuranceEnrolled` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `taxExemptionAmount` DECIMAL(15, 2) NULL DEFAULT 0,
  ADD COLUMN `jobTitleId` VARCHAR(191) NULL,
  ADD COLUMN `costCenterId` VARCHAR(191) NULL;

ALTER TABLE `employee_advances`
  ADD COLUMN `remainingAmount` DECIMAL(15, 2) NULL,
  ADD COLUMN `isSettled` BOOLEAN NOT NULL DEFAULT false;

UPDATE `employee_advances` SET `remainingAmount` = `value` WHERE `remainingAmount` IS NULL;

CREATE TABLE `hr_settings` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `salariesExpenseAccountCode` VARCHAR(20) NULL,
  `employerInsuranceExpenseAccountCode` VARCHAR(20) NULL,
  `socialInsurancePayableAccountCode` VARCHAR(20) NULL,
  `payrollTaxPayableAccountCode` VARCHAR(20) NULL,
  `employeeAdvancesAccountCode` VARCHAR(20) NULL,
  `accruedPayrollAccountCode` VARCHAR(20) NULL,
  `employeeInsuranceRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.11,
  `employerInsuranceRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.1875,
  `payrollTaxFlatRate` DECIMAL(8, 6) NOT NULL DEFAULT 0.10,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hr_settings_companyId_key` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payroll_runs` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `fiscalYearId` VARCHAR(191) NULL,
  `periodMonth` INTEGER NOT NULL,
  `periodYear` INTEGER NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `totalGross` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalNet` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalEmployerInsurance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalEmployeeInsurance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalTax` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalAdvanceDeduction` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `accrualJournalEntryId` VARCHAR(191) NULL,
  `paymentJournalEntryId` VARCHAR(191) NULL,
  `paymentSafeId` VARCHAR(191) NULL,
  `paymentBankAccountId` VARCHAR(191) NULL,
  `postedAt` DATETIME(3) NULL,
  `paidAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `payroll_runs_companyId_periodYear_periodMonth_key` (`companyId`, `periodYear`, `periodMonth`),
  INDEX `payroll_runs_companyId_status_idx` (`companyId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payroll_run_items` (
  `id` VARCHAR(191) NOT NULL,
  `payrollRunId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `basicSalary` DECIMAL(15, 2) NOT NULL,
  `allowances` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `overtime` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `absenceDeduction` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `otherDeductions` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `grossSalary` DECIMAL(15, 2) NOT NULL,
  `employerInsurance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `employeeInsurance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `tax` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `advanceDeduction` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `netSalary` DECIMAL(15, 2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `payroll_run_items_payrollRunId_employeeId_key` (`payrollRunId`, `employeeId`),
  INDEX `payroll_run_items_employeeId_idx` (`employeeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
