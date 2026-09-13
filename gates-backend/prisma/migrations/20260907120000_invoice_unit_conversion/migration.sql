-- ItemUnit: fixed vs variable conversion factor
ALTER TABLE `item_units`
  ADD COLUMN `isFactorFixed` BOOLEAN NOT NULL DEFAULT TRUE;

-- Invoice line: snapshot of base unit + conversion factor at movement time
ALTER TABLE `invoice_lines`
  ADD COLUMN `baseUnitId` VARCHAR(191) NULL,
  ADD COLUMN `conversionFactor` DECIMAL(18, 6) NULL;

CREATE INDEX `invoice_lines_baseUnitId_idx` ON `invoice_lines`(`baseUnitId`);

ALTER TABLE `invoice_lines`
  ADD CONSTRAINT `invoice_lines_baseUnitId_fkey`
  FOREIGN KEY (`baseUnitId`) REFERENCES `units`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Company + invoice pricing basis
ALTER TABLE `company_settings`
  ADD COLUMN `pricingCalculationBasis` VARCHAR(30) NOT NULL DEFAULT 'SELECTED_UNIT_QTY';

ALTER TABLE `invoices`
  ADD COLUMN `pricingCalculationBasis` VARCHAR(30) NULL;
