-- Master-card parity fields (Item / Account / CostCenter).
-- Additive + defaulted so existing rows stay valid.

-- Item flags + price tiers
ALTER TABLE `items`
  ADD COLUMN `isService` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `isAssembly` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `isTaxExempt` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `consumerPrice` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `retailPrice` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `representativePrice` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `exportPrice` DECIMAL(18, 4) NOT NULL DEFAULT 0;

UPDATE `items`
SET `retailPrice` = `priceRetail`
WHERE `retailPrice` = 0 AND `priceRetail` <> 0;

-- Account nature / statement / cost-center requirement
ALTER TABLE `accounts`
  ADD COLUMN `accountNature` ENUM('DEBIT', 'CREDIT') NOT NULL DEFAULT 'DEBIT',
  ADD COLUMN `statementType` ENUM('BALANCE_SHEET', 'INCOME_STATEMENT') NOT NULL DEFAULT 'BALANCE_SHEET',
  ADD COLUMN `requiresCostCenter` BOOLEAN NOT NULL DEFAULT false;

UPDATE `accounts`
SET `accountNature` = 'CREDIT'
WHERE `accountSide` = 'دائن';

UPDATE `accounts`
SET `requiresCostCenter` = true
WHERE `costCenterRequired` = 'إجباري';

-- Cost-center parent lookup
CREATE INDEX `cost_centers_companyId_parentId_idx` ON `cost_centers`(`companyId`, `parentId`);
