-- Optional default cost center on each GL account.
ALTER TABLE `accounts` ADD COLUMN `defaultCostCenterId` VARCHAR(191) NULL;

CREATE INDEX `accounts_defaultCostCenterId_idx` ON `accounts`(`defaultCostCenterId`);

ALTER TABLE `accounts`
  ADD CONSTRAINT `accounts_defaultCostCenterId_fkey`
  FOREIGN KEY (`defaultCostCenterId`) REFERENCES `cost_centers`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
