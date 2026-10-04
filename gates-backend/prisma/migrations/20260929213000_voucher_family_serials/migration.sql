-- Each voucher type keeps its own serial. Cash and bank rows of the same
-- receipt or payment table may reuse a number; uniqueness stays inside the type.

ALTER TABLE `treasury_receipts`
  ADD COLUMN `voucherFamily` VARCHAR(10) NOT NULL DEFAULT 'CASH';

UPDATE `treasury_receipts`
SET `voucherFamily` = 'BANK'
WHERE `bankAccountId` IS NOT NULL;

ALTER TABLE `treasury_receipts` DROP INDEX `treasury_receipts_companyId_voucherNumber_key`;

CREATE UNIQUE INDEX `treasury_receipts_companyId_voucherFamily_voucherNumber_key`
  ON `treasury_receipts`(`companyId`, `voucherFamily`, `voucherNumber`);

ALTER TABLE `treasury_payments`
  ADD COLUMN `voucherFamily` VARCHAR(10) NOT NULL DEFAULT 'CASH';

UPDATE `treasury_payments`
SET `voucherFamily` = 'BANK'
WHERE `bankAccountId` IS NOT NULL;

ALTER TABLE `treasury_payments` DROP INDEX `treasury_payments_companyId_voucherNumber_key`;

CREATE UNIQUE INDEX `treasury_payments_companyId_voucherFamily_voucherNumber_key`
  ON `treasury_payments`(`companyId`, `voucherFamily`, `voucherNumber`);
