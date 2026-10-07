ALTER TABLE `hr_settings`
  ADD COLUMN `payrollEngineMode` VARCHAR(32) NOT NULL DEFAULT 'LEGACY_COMPATIBILITY',
  ADD COLUMN `payrollRequireTimeReady` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `hcm_payroll_item_components`
  ADD COLUMN `ruleId` VARCHAR(36) NULL,
  ADD COLUMN `ruleFormulaFingerprint` VARCHAR(64) NULL,
  ADD COLUMN `roundingMode` VARCHAR(20) NULL,
  ADD COLUMN `glExpenseAccountIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `glPayableAccountIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `branchIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `departmentIdSnapshot` VARCHAR(36) NULL,
  ADD COLUMN `costCenterIdSnapshot` VARCHAR(36) NULL;

ALTER TABLE `payroll_runs`
  ADD COLUMN `reversedAt` DATETIME(3) NULL,
  ADD COLUMN `reversedById` VARCHAR(36) NULL,
  ADD COLUMN `calculationJobId` VARCHAR(64) NULL;
