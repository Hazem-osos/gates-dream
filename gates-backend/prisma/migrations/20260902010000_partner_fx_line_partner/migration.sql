-- Line-level party on journal lines (shared AR/AP control accounts).
ALTER TABLE `journal_entry_lines`
    ADD COLUMN `partnerId` VARCHAR(191) NULL,
    ADD COLUMN `partnerType` VARCHAR(20) NULL;

CREATE INDEX `journal_entry_lines_partnerId_idx` ON `journal_entry_lines`(`partnerId`);

-- Old partner totals stored base amounts under the document currency code.
-- Drop and recreate; reports fall back to aged open items until posts refill.
ALTER TABLE `partner_running_balances`
    DROP FOREIGN KEY `partner_running_balances_companyId_fkey`;

DROP TABLE `partner_running_balances`;

CREATE TABLE `partner_running_balances` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `partnerId` VARCHAR(191) NOT NULL,
    `partnerType` VARCHAR(20) NOT NULL,
    `currencyCode` VARCHAR(10) NOT NULL,
    `debitOriginalCurrency` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `creditOriginalCurrency` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `netOriginalCurrency` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `debitBaseCurrency` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `creditBaseCurrency` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `netBaseCurrency` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `lastEntryDate` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `partner_running_balances_companyId_partnerId_currencyCode_key` (`companyId`, `partnerId`, `currencyCode`),
    INDEX `partner_running_balances_companyId_partnerType_idx` (`companyId`, `partnerType`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `partner_running_balances`
    ADD CONSTRAINT `partner_running_balances_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
