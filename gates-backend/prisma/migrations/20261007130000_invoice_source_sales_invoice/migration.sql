-- Add SALES_INVOICE to invoice source document enum (posted sales invoices for returns / load bar)
ALTER TABLE `invoices` MODIFY COLUMN `sourceType` ENUM(
  'QUOTATION',
  'SALES_ORDER',
  'PURCHASE_ORDER',
  'PURCHASE_INVOICE',
  'DELIVERY_NOTE',
  'GOODS_RECEIPT',
  'SALES_INVOICE',
  'NONE'
) NOT NULL DEFAULT 'NONE';
