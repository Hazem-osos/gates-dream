-- Add GOODS_RECEIPT to invoice source document enum (load purchase invoice from stock receipt).
ALTER TABLE `invoices`
  MODIFY `sourceType` ENUM(
    'QUOTATION',
    'SALES_ORDER',
    'PURCHASE_ORDER',
    'PURCHASE_INVOICE',
    'DELIVERY_NOTE',
    'GOODS_RECEIPT',
    'NONE'
  ) NOT NULL DEFAULT 'NONE';
