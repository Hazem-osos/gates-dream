-- Wave 3: SALES_ORDER_TO_SALE_INVOICE previously had no already-converted
-- guard (unlike PurchaseOrder.invoiceId) — the same draft "sales order"
-- could be cloned into an unbounded number of full invoices.
ALTER TABLE `invoices` ADD COLUMN `convertedInvoiceId` CHAR(36) NULL;

ALTER TABLE `invoices` ADD CONSTRAINT `invoices_convertedInvoiceId_key` UNIQUE (`convertedInvoiceId`);

ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_convertedInvoiceId_fkey`
    FOREIGN KEY (`convertedInvoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
