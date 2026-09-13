-- Add FKs to Currency where applicable (MySQL version)
-- Note: Only add if tables exist

SET @bank_accounts_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'bank_accounts');
SET @safes_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'safes');
SET @currencies_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'currencies');

-- Add foreign keys only if both tables exist
SET @sql = IF(@bank_accounts_exists > 0 AND @currencies_exists > 0,
    'ALTER TABLE `bank_accounts` ADD CONSTRAINT `fk_bankaccount_currency` FOREIGN KEY (`currencyCode`) REFERENCES `currencies`(`code`) ON UPDATE CASCADE ON DELETE RESTRICT',
    'SELECT "Skipping bank_accounts currency FK"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@safes_exists > 0 AND @currencies_exists > 0,
    'ALTER TABLE `safes` ADD CONSTRAINT `fk_safe_currency` FOREIGN KEY (`currencyCode`) REFERENCES `currencies`(`code`) ON UPDATE CASCADE ON DELETE RESTRICT',
    'SELECT "Skipping safes currency FK"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Note: ReceiptVoucher and PaymentVoucher tables may not exist yet
-- Add their FKs in a later migration or when those tables are created
