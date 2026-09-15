-- Treasury voucher settings: receipt / payment / bank debit / bank credit

ALTER TABLE `transaction_settings`
  MODIFY `documentType` ENUM(
    'SALES_INVOICE',
    'PURCHASE_INVOICE',
    'PAYMENT_VOUCHER',
    'RECEIPT_VOUCHER',
    'STOCK_ISSUE',
    'STOCK_RECEIPT',
    'SALES_RETURN',
    'PURCHASE_RETURN',
    'BANK_DEBIT_ADVICE',
    'BANK_CREDIT_ADVICE'
  ) NOT NULL DEFAULT 'SALES_INVOICE';

ALTER TABLE `document_profiles`
  MODIFY `baseType` ENUM(
    'SALES_INVOICE',
    'PURCHASE_INVOICE',
    'PAYMENT_VOUCHER',
    'RECEIPT_VOUCHER',
    'STOCK_ISSUE',
    'STOCK_RECEIPT',
    'SALES_RETURN',
    'PURCHASE_RETURN',
    'BANK_DEBIT_ADVICE',
    'BANK_CREDIT_ADVICE'
  ) NOT NULL;

ALTER TABLE `transaction_settings`
  ADD COLUMN `defaultCashAccountId` VARCHAR(191) NULL,
  ADD COLUMN `defaultBankGlAccountId` VARCHAR(191) NULL,
  ADD COLUMN `defaultOffsetAccountId` VARCHAR(191) NULL,
  ADD COLUMN `defaultChargesAccountId` VARCHAR(191) NULL;

CREATE INDEX `transaction_settings_defaultCashAccountId_idx`
  ON `transaction_settings`(`defaultCashAccountId`);
CREATE INDEX `transaction_settings_defaultBankGlAccountId_idx`
  ON `transaction_settings`(`defaultBankGlAccountId`);
CREATE INDEX `transaction_settings_defaultOffsetAccountId_idx`
  ON `transaction_settings`(`defaultOffsetAccountId`);
CREATE INDEX `transaction_settings_defaultChargesAccountId_idx`
  ON `transaction_settings`(`defaultChargesAccountId`);

ALTER TABLE `transaction_settings`
  ADD CONSTRAINT `transaction_settings_defaultCashAccountId_fkey`
    FOREIGN KEY (`defaultCashAccountId`) REFERENCES `accounts`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `transaction_settings_defaultBankGlAccountId_fkey`
    FOREIGN KEY (`defaultBankGlAccountId`) REFERENCES `accounts`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `transaction_settings_defaultOffsetAccountId_fkey`
    FOREIGN KEY (`defaultOffsetAccountId`) REFERENCES `accounts`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `transaction_settings_defaultChargesAccountId_fkey`
    FOREIGN KEY (`defaultChargesAccountId`) REFERENCES `accounts`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
