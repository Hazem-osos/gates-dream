-- Align partner_running_balances with debitOriginal / debitBase names.
-- Safe after 20260902010000 (Currency-suffixed columns) or a no-op path
-- if those names already match.

ALTER TABLE `partner_running_balances`
    CHANGE COLUMN `debitOriginalCurrency` `debitOriginal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    CHANGE COLUMN `creditOriginalCurrency` `creditOriginal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    CHANGE COLUMN `netOriginalCurrency` `netOriginal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    CHANGE COLUMN `debitBaseCurrency` `debitBase` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    CHANGE COLUMN `creditBaseCurrency` `creditBase` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    CHANGE COLUMN `netBaseCurrency` `netBase` DECIMAL(18, 4) NOT NULL DEFAULT 0;

CREATE INDEX `partner_running_balances_companyId_idx` ON `partner_running_balances`(`companyId`);
CREATE INDEX `partner_running_balances_partnerId_idx` ON `partner_running_balances`(`partnerId`);
