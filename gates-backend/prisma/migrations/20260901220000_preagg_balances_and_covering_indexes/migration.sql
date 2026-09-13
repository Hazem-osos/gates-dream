-- Phase 1: pre-aggregated GL / partner balances
CREATE TABLE `account_period_balances` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `fiscalYear` INTEGER NOT NULL,
    `periodMonth` INTEGER NOT NULL,
    `debitTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `creditTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `netBalance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `apb_company_account_period_key` (`companyId`, `accountId`, `fiscalYear`, `periodMonth`),
    INDEX `account_period_balances_companyId_fiscalYear_periodMonth_idx` (`companyId`, `fiscalYear`, `periodMonth`),
    INDEX `account_period_balances_accountId_idx` (`accountId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `partner_running_balances` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `partnerId` VARCHAR(191) NOT NULL,
    `partnerType` VARCHAR(20) NOT NULL,
    `currency` VARCHAR(10) NOT NULL,
    `totalDebit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `totalCredit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `netBalance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `lastEntryDate` DATETIME(3) NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `partner_running_balances_companyId_partnerId_currency_key` (`companyId`, `partnerId`, `currency`),
    INDEX `partner_running_balances_companyId_partnerType_idx` (`companyId`, `partnerType`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `account_period_balances`
    ADD CONSTRAINT `account_period_balances_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `account_period_balances`
    ADD CONSTRAINT `account_period_balances_accountId_fkey`
    FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `partner_running_balances`
    ADD CONSTRAINT `partner_running_balances_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 4: covering composites for list/filter/sort (MySQL has no INCLUDE;
-- extra key columns keep filtered listings on the index).
CREATE INDEX `idx_journal_entries_company_posted_date`
    ON `journal_entries` (`companyId`, `isPosted`, `date` DESC);

CREATE INDEX `idx_invoices_kind_posted_date`
    ON `invoices` (`companyId`, `invoiceKind`, `isPosted`, `date` DESC);

CREATE INDEX `idx_inventory_movements_date_type`
    ON `inventory_movements` (`companyId`, `documentDate` DESC, `movementType`);
