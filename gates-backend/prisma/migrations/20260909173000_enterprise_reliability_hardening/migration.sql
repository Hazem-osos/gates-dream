-- AI monthly token quotas + cash-document optimistic lock.

ALTER TABLE `companies`
    ADD COLUMN `aiMonthlyTokenLimit` INTEGER NOT NULL DEFAULT 250000,
    ADD COLUMN `aiTokensUsedThisMonth` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `aiQuotaResetDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `cash_transactions`
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;
