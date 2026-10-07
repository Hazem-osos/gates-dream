ALTER TABLE `payroll_runs`
  ADD COLUMN `negativeNetOverrideReason` TEXT NULL,
  ADD COLUMN `negativeNetOverrideById` VARCHAR(36) NULL,
  ADD COLUMN `negativeNetOverrideAt` DATETIME(3) NULL;
