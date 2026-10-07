-- HCM Phase 2.1: employment episodes + contract chain metadata

ALTER TABLE `hcm_employments` DROP INDEX `hcm_employments_companyId_employeeId_key`;

ALTER TABLE `hcm_employments`
  ADD COLUMN `episodeNumber` INT NOT NULL DEFAULT 1,
  ADD COLUMN `previousEmploymentId` VARCHAR(191) NULL;

CREATE INDEX `hcm_employments_companyId_employeeId_idx` ON `hcm_employments`(`companyId`, `employeeId`);
CREATE INDEX `hcm_employments_companyId_employeeId_status_idx` ON `hcm_employments`(`companyId`, `employeeId`, `status`);

ALTER TABLE `hcm_employments`
  ADD CONSTRAINT `hcm_employments_previousEmploymentId_fkey`
  FOREIGN KEY (`previousEmploymentId`) REFERENCES `hcm_employments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `employee_contracts`
  ADD COLUMN `previousContractId` VARCHAR(191) NULL,
  ADD COLUMN `contractStatus` VARCHAR(20) NULL DEFAULT 'ACTIVE';

ALTER TABLE `employee_contracts`
  ADD CONSTRAINT `employee_contracts_previousContractId_fkey`
  FOREIGN KEY (`previousContractId`) REFERENCES `employee_contracts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `hcm_employment_events` ADD COLUMN `contractId` VARCHAR(191) NULL;
CREATE INDEX `hcm_employment_events_contractId_idx` ON `hcm_employment_events`(`contractId`);
