-- Distinguish commercial-paper journals from manual GL entries.
ALTER TABLE `journal_entries`
  MODIFY COLUMN `sourceKind` ENUM(
    'MANUAL',
    'RECURRING_TEMPLATE',
    'SALES_INVOICE',
    'SALES_RETURN',
    'PURCHASE_INVOICE',
    'PURCHASE_RETURN',
    'PAYMENT_VOUCHER',
    'RECEIPT_VOUCHER',
    'STOCK_TRANSACTION',
    'DEPRECIATION',
    'CHEQUE_ENDORSEMENT',
    'CLOSING_ENTRY',
    'SECURITIES_RECEIPT',
    'SECURITIES_PAYMENT'
  ) NOT NULL DEFAULT 'MANUAL';

UPDATE `journal_entries`
  SET `sourceKind` = 'SECURITIES_RECEIPT'
  WHERE `sourceType` IN ('SECR', 'SECREN');

UPDATE `journal_entries`
  SET `sourceKind` = 'SECURITIES_PAYMENT'
  WHERE `sourceType` IN ('SECP');
