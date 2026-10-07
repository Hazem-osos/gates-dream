ALTER TABLE `hr_settings`
  ADD COLUMN `payrollProrationMethod` VARCHAR(32) NOT NULL DEFAULT 'CALENDAR_DAYS',
  ADD COLUMN `payrollNegativeNetPolicy` VARCHAR(32) NOT NULL DEFAULT 'BLOCK',
  ADD COLUMN `payrollRequireApprovalBeforePost` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `payrollCalculatorCannotApproveOwnRun` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `payroll_runs`
  ADD COLUMN `createdById` VARCHAR(36) NULL,
  ADD COLUMN `reviewedById` VARCHAR(36) NULL,
  ADD COLUMN `reviewedAt` DATETIME(3) NULL,
  ADD COLUMN `approvedById` VARCHAR(36) NULL,
  ADD COLUMN `approvedAt` DATETIME(3) NULL,
  ADD COLUMN `postedById` VARCHAR(36) NULL,
  ADD COLUMN `paidById` VARCHAR(36) NULL;

ALTER TABLE `hcm_payroll_item_components`
  ADD COLUMN `ruleFingerprint` VARCHAR(64) NULL,
  ADD COLUMN `sourceType` VARCHAR(32) NULL,
  ADD COLUMN `sourceRef` VARCHAR(64) NULL,
  ADD COLUMN `glAccountId` VARCHAR(36) NULL;
