-- Checks and unique constraints (MySQL version)

-- Add unique constraints and checks where applicable
-- Note: MySQL CHECK constraints are supported in MySQL 8.0.16+

-- Example unique constraints (add as needed when tables exist)
-- ALTER TABLE `accounts` ADD CONSTRAINT `uk_account_company_code` UNIQUE (`companyId`, `code`);
-- ALTER TABLE `cost_centers` ADD CONSTRAINT `uk_costcenter_company_code` UNIQUE (`companyId`, `code`);

-- Example check constraints (MySQL 8.0.16+)
-- ALTER TABLE `journal_entry_lines` ADD CONSTRAINT `chk_debit_credit_not_both` CHECK ((debit = 0 OR credit = 0) OR (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0));

SELECT 'Checks and uniques - add specific constraints as needed' AS note;
