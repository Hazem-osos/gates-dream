-- Purchase returns engine: PURCHASE_RETURN settings + purchase-return GL default

ALTER TABLE `transaction_settings`
  MODIFY `documentType` ENUM(
    'SALES_INVOICE',
    'PURCHASE_INVOICE',
    'PAYMENT_VOUCHER',
    'RECEIPT_VOUCHER',
    'STOCK_ISSUE',
    'STOCK_RECEIPT',
    'SALES_RETURN',
    'PURCHASE_RETURN'
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
    'PURCHASE_RETURN'
  ) NOT NULL;

ALTER TABLE `transaction_settings`
  ADD COLUMN `defaultPurchaseReturnAccountId` VARCHAR(191) NULL;

CREATE INDEX `transaction_settings_defaultPurchaseReturnAccountId_idx`
  ON `transaction_settings`(`defaultPurchaseReturnAccountId`);

ALTER TABLE `transaction_settings`
  ADD CONSTRAINT `transaction_settings_defaultPurchaseReturnAccountId_fkey`
    FOREIGN KEY (`defaultPurchaseReturnAccountId`) REFERENCES `accounts`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
