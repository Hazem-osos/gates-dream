-- Accounting settings engine: company-wide posting guardrails + rounding / FX defaults.
-- Account IDs are validated in AccountingSettingsService (same companyId, postable leaf).
-- DB-level FKs to accounts.id are omitted: accounts.id / companies.id use
-- utf8mb4_unicode_ci while newly created tables default to utf8mb4_0900_ai_ci.

ALTER TABLE `company_settings`
  ADD COLUMN `preventNegativeStock` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `preventCashOverdraft` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `enforceCostCenterForPnl` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `preventSellingBelowCost` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `roundingAccountId` VARCHAR(191) NULL,
  ADD COLUMN `exchangeGainLossAccountId` VARCHAR(191) NULL;

CREATE INDEX `company_settings_roundingAccountId_idx`
  ON `company_settings`(`roundingAccountId`);

CREATE INDEX `company_settings_exchangeGainLossAccountId_idx`
  ON `company_settings`(`exchangeGainLossAccountId`);
