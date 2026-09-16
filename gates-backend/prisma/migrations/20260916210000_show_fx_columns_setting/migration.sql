-- AlterTable
ALTER TABLE `transaction_settings`
  ADD COLUMN `showFxColumns` BOOLEAN NOT NULL DEFAULT true;

-- AlterEnum DocumentBaseType (transaction_settings + document_profiles)
ALTER TABLE `transaction_settings`
  MODIFY COLUMN `documentType` ENUM(
    'SALES_INVOICE',
    'PURCHASE_INVOICE',
    'PAYMENT_VOUCHER',
    'RECEIPT_VOUCHER',
    'STOCK_ISSUE',
    'STOCK_RECEIPT',
    'SALES_RETURN',
    'PURCHASE_RETURN',
    'BANK_DEBIT_ADVICE',
    'BANK_CREDIT_ADVICE',
    'JOURNAL_ENTRY',
    'OPENING_BALANCE'
  ) NOT NULL DEFAULT 'SALES_INVOICE';

ALTER TABLE `document_profiles`
  MODIFY COLUMN `baseType` ENUM(
    'SALES_INVOICE',
    'PURCHASE_INVOICE',
    'PAYMENT_VOUCHER',
    'RECEIPT_VOUCHER',
    'STOCK_ISSUE',
    'STOCK_RECEIPT',
    'SALES_RETURN',
    'PURCHASE_RETURN',
    'BANK_DEBIT_ADVICE',
    'BANK_CREDIT_ADVICE',
    'JOURNAL_ENTRY',
    'OPENING_BALANCE'
  ) NOT NULL;
